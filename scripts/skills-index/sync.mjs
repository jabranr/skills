#!/usr/bin/env node
// Keeps the skills index and the Claude Code plugin marketplace in step with the library.
//
//   node scripts/skills-index/sync.mjs           discover, update catalog.json, render both outputs
//   node scripts/skills-index/sync.mjs --prune   also drop catalog entries that were not discovered
//   node scripts/skills-index/sync.mjs --check   render from catalog.json only; exit 1 if an output is stale
//
// Discovery sources:
//   - this repo's skills/ directory (jabranr/skills)
//   - the `skills` CLI lock file: ~/.agents/.skill-lock.json (or --lock <path>)
//   - Claude Code plugins installed from a marketplace: ~/.claude/plugins (or --plugins <dir>)
//   - plugins listed by hand in catalog.json `plugins` (e.g. ones synced from a claude.ai account)
// Every source repo is shallow-cloned (no blobs) so paths and default branches come from the repo itself.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = join(ROOT, 'scripts/skills-index/catalog.json');
const SKILL = join(ROOT, 'skills/jabraf-skills-index/SKILL.md');
const MARKETPLACE = join(ROOT, '.claude-plugin/marketplace.json');
const OWN_REPO = 'jabranr/skills';
const MARKET_NAME = 'jabraf';
const START = '<!-- catalog:start -->';
const END = '<!-- catalog:end -->';
const UNSORTED = 'Unsorted (move into a group and rewrite `when`)';

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const check = args.includes('--check');
const prune = args.includes('--prune');
const LOCK = flag('--lock', join(homedir(), '.agents/.skill-lock.json'));
const PLUGINS_DIR = flag('--plugins', join(homedir(), '.claude/plugins'));

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined);

// ---------- repos ----------

const repos = new Map();
const scratch = mkdtempSync(join(tmpdir(), 'skills-index-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));

function repo(name) {
  if (repos.has(name)) return repos.get(name);
  const dir = join(scratch, name.replace('/', '__'));
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  execFileSync('git', [
    'clone',
    '-q',
    '--depth',
    '1',
    '--filter=blob:none',
    '--no-checkout',
    `https://github.com/${name}.git`,
    dir,
  ]);
  const files = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean);
  const r = {
    name,
    branch: git('symbolic-ref', '--short', 'HEAD').trim(),
    files,
    has: (path) => files.includes(path) || files.some((f) => f.startsWith(`${path}/`)),
    read: (path) => (files.includes(path) ? git('show', `HEAD:${path}`) : undefined),
    skills: files.filter((f) => f === 'SKILL.md' || f.endsWith('/SKILL.md')).map((f) => dirname(f)),
  };
  repos.set(name, r);
  return r;
}

function frontmatter(md = '') {
  const fm = md.split(/^---$/m)[1] ?? '';
  const field = (key) =>
    fm
      .match(new RegExp(`^${key}:\\s*(.*(?:\\n[ \\t]+.*)*)`, 'm'))?.[1]
      .replace(/^[>|]-?\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["']|["']$/g, '');
  const description = field('description') ?? '';
  return { name: field('name'), firstSentence: (description.match(/^.*?[.!?](\s|$)/)?.[0] ?? description).trim() };
}

// ---------- discovery ----------

function sourceRepo(source) {
  if (source.source === 'github') return { repo: source.repo, path: source.path ?? '' };
  if (source.source === 'git-subdir' || source.source === 'url') {
    const m = source.url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?(?:\/|$)/);
    if (m) return { repo: m[1], path: source.path ?? '' };
  }
  return undefined;
}

// Plugins installed from a marketplace, read back to the GitHub repo that holds them.
function installedPlugins() {
  const installed = readJson(join(PLUGINS_DIR, 'installed_plugins.json'))?.plugins ?? {};
  const markets = readJson(join(PLUGINS_DIR, 'known_marketplaces.json')) ?? {};
  const out = {};
  for (const id of Object.keys(installed)) {
    const [plugin, market] = id.split('@');
    const m = markets[market];
    // Skip unknown marketplaces, non-GitHub ones, and this repo's own (its plugins are already the source).
    if (m?.source?.source !== 'github' || m.source.repo === OWN_REPO || !m.installLocation) continue;
    const entry = readJson(join(m.installLocation, '.claude-plugin/marketplace.json'))?.plugins?.find(
      (p) => p.name === plugin
    );
    if (!entry) continue;
    out[plugin] =
      typeof entry.source === 'string'
        ? entry.source.replace(/^\.\/?/, '') === ''
          ? { source: 'github', repo: m.source.repo }
          : {
              source: 'git-subdir',
              url: `https://github.com/${m.source.repo}.git`,
              path: entry.source.replace(/^\.\//, ''),
            }
        : entry.source;
  }
  return out;
}

function discover() {
  const found = new Map(); // name -> { repo, path, plugin? }
  const add = (name, info) => {
    const existing = found.get(name);
    if (existing && existing.repo !== info.repo) {
      if (!info.plugin) return console.warn(`! ${name}: also in ${info.repo}; keeping ${existing.repo}`);
      name = `${info.plugin}:${name}`;
    }
    found.set(name, { ...existing, ...info, plugin: info.plugin ?? existing?.plugin });
  };

  for (const name of readdirSync(join(ROOT, 'skills'))) {
    if (existsSync(join(ROOT, 'skills', name, 'SKILL.md'))) add(name, { repo: OWN_REPO, path: `skills/${name}` });
  }

  const lock = readJson(LOCK);
  if (!lock) console.warn(`No lock file at ${LOCK}; skipping CLI-installed skills.`);
  for (const [name, s] of Object.entries(lock?.skills ?? {})) {
    if (s.sourceType !== 'github' || s.source === OWN_REPO) continue;
    const r = repo(s.source);
    let path = dirname(s.skillPath);
    if (!r.has(`${path}/SKILL.md`)) {
      const moved = r.skills.find((d) => basename(d) === name);
      if (!moved) {
        console.warn(`! ${name}: no longer in ${s.source}`);
        continue;
      }
      console.log(`~ ${name}: moved upstream to ${moved}`);
      path = moved;
    }
    add(name, { repo: s.source, path });
  }

  // The catalog is a source too, so skills stay listed after they are uninstalled locally
  // (e.g. when only jabraf-skills-index is installed). Plugin skills are rediscovered below.
  for (const s of catalog.groups.flatMap((g) => g.skills)) {
    if (found.has(s.name) || s.plugin || !s.repo || s.repo === OWN_REPO) continue;
    const r = repo(s.repo);
    const path = r.has(`${s.path}/SKILL.md`) ? s.path : r.skills.find((d) => basename(d) === s.name);
    if (!path) {
      console.warn(`! ${s.name}: no longer in ${s.repo}`);
      continue;
    }
    if (path !== s.path) console.log(`~ ${s.name}: moved upstream to ${path}`);
    add(s.name, { repo: s.repo, path });
  }

  for (const [plugin, installed] of Object.entries(installedPlugins())) {
    const current = catalog.plugins[plugin]?.source;
    const loc = (s) => s && sourceRepo(s);
    const same =
      loc(current) && loc(installed)?.repo === loc(current).repo && loc(installed).path === loc(current).path;
    // Keep the catalog's source when it points at the same place. Marketplaces pin plugins to a
    // commit (`sha`/`ref`) and bump it often; carrying that pin over would churn the catalog and
    // hold this marketplace back at whatever commit happens to be installed locally.
    if (same) continue;
    const { sha, ref, ...source } = installed;
    catalog.plugins[plugin] = { ...catalog.plugins[plugin], source };
  }
  for (const [plugin, cfg] of Object.entries(catalog.plugins)) {
    const loc = sourceRepo(cfg.source);
    if (!loc) continue;
    const r = repo(loc.repo);
    const prefix = loc.path ? `${loc.path}/` : '';
    const excluded = (d) => (cfg.exclude ?? []).some((e) => `${d}/`.startsWith(prefix + e));
    for (const dir of r.skills.filter((d) => (prefix ? d.startsWith(prefix) : true) && !excluded(d))) {
      const name = frontmatter(r.read(`${dir}/SKILL.md`)).name ?? basename(dir);
      const lockPath = found.get(name);
      add(name, { repo: loc.repo, path: lockPath?.repo === loc.repo ? lockPath.path : dir, plugin });
    }
    const extras = ['agents', 'commands', 'hooks', '.mcp.json'].filter((x) => r.has(prefix + x));
    const manifest = JSON.parse(r.read(`${prefix}.claude-plugin/plugin.json`) ?? '{}');
    catalog.plugins[plugin] = {
      ...cfg,
      description: manifest.description ?? cfg.description,
      extras,
    };
  }
  return found;
}

function sync() {
  const found = discover();
  const listed = new Map(catalog.groups.flatMap((g) => g.skills.map((s) => [s.name, s])));

  for (const [name, info] of found) {
    if (catalog.skip[name]) continue;
    let entry = listed.get(name);
    if (!entry) {
      let group = catalog.groups.find((g) => g.title === UNSORTED);
      if (!group) catalog.groups.push((group = { title: UNSORTED, skills: [] }));
      const md = repo(info.repo).read(`${info.path}/SKILL.md`);
      entry = { name, when: frontmatter(md).firstSentence || 'TODO' };
      group.skills.push(entry);
      console.log(`+ ${name} (added to "${UNSORTED}")`);
    }
    delete entry.plugin;
    Object.assign(entry, { repo: info.repo, path: info.path }, info.plugin && { plugin: info.plugin });
  }

  for (const [name] of listed) {
    if (found.has(name)) continue;
    if (prune) {
      for (const g of catalog.groups) g.skills = g.skills.filter((s) => s.name !== name);
      console.log(`- ${name} (pruned)`);
    } else {
      console.warn(`! ${name} is in the catalog but was not discovered; keeping it (pass --prune to drop)`);
    }
  }
  catalog.groups = catalog.groups.filter((g) => g.skills.length);

  const used = [...new Set(catalog.groups.flatMap((g) => g.skills.map((s) => s.repo)))].sort();
  catalog.sources = Object.fromEntries(used.map((r) => [r, { branch: repo(r).branch }]));
}

// ---------- rendering ----------

function renderCatalog() {
  const lines = [
    START,
    '<!-- Generated by `npm run skills:index` from scripts/skills-index/catalog.json. Edit that file, not this block. -->',
    '',
  ];
  for (const g of catalog.groups) {
    lines.push(`### ${g.title}`, '');
    for (const s of g.skills) {
      if (!s.repo) throw new Error(`${s.name} has no source; run without --check to resolve it`);
      const branch = catalog.sources[s.repo]?.branch ?? 'main';
      const tag = s.plugin ? ` (plugin \`${s.plugin}\`)` : '';
      lines.push(
        `- \`${s.name}\`${tag}: ${s.when.replace(/[.\s]+$/, '')}. \`https://github.com/${s.repo}/tree/${branch}/${s.path}\``
      );
    }
    lines.push('');
  }
  const withExtras = Object.entries(catalog.plugins).filter(([, p]) => p.extras?.length);
  if (withExtras.length) {
    lines.push(
      '### Plugin parts only Claude Code can load',
      '',
      `These plugins also ship agents, commands, hooks or MCP servers. Their skills are listed above; for the rest, install the plugin in Claude Code with \`/plugin install <plugin> --marketplace ${OWN_REPO}\`.`,
      ''
    );
    for (const [name, p] of withExtras) lines.push(`- \`${name}\`: ${p.extras.map((x) => `\`${x}\``).join(', ')}`);
    lines.push('');
  }
  lines.push(END);
  return lines.join('\n');
}

function renderMarketplace() {
  return JSON.stringify({
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: MARKET_NAME,
    description: "Jabran's skills plus the third-party Claude Code plugins used alongside them.",
    owner: { name: 'Jabran Rafique', url: 'https://github.com/jabranr' },
    plugins: [
      {
        name: 'jabraf-skills',
        description: 'Every skill in jabranr/skills, including the jabraf-skills-index router.',
        source: './',
        strict: false,
      },
      ...Object.entries(catalog.plugins).map(([name, p]) => ({
        name,
        ...(p.description && { description: p.description }),
        source: p.source,
      })),
    ],
  });
}

async function format(text, filepath) {
  return prettier.format(text, { ...((await prettier.resolveConfig(filepath)) ?? {}), filepath });
}

async function outputs() {
  const [head, rest] = readFileSync(SKILL, 'utf8').split(START);
  const { version } = readJson(join(ROOT, 'node_modules/skills/package.json'));
  const skill = `${head}${renderCatalog()}${rest.split(END)[1]}`.replace(/skills@\d+\.\d+\.\d+/g, `skills@${version}`);
  return [
    [SKILL, await format(skill, SKILL)],
    [MARKETPLACE, await format(renderMarketplace(), MARKETPLACE)],
  ];
}

if (!check) {
  sync();
  writeFileSync(CATALOG, await format(JSON.stringify(catalog), CATALOG));
}
let stale = false;
for (const [file, next] of await outputs()) {
  const rel = file.replace(`${ROOT}/`, '');
  if (check) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== next) {
      console.error(`${rel} is out of date. Run \`npm run skills:index\`.`);
      stale = true;
    }
  } else {
    writeFileSync(file, next);
    console.log(`Wrote ${rel}.`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log('Skills index and marketplace are up to date.');
} else {
  console.log(`${catalog.groups.reduce((n, g) => n + g.skills.length, 0)} skills in the index.`);
}
