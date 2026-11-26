#!/usr/bin/env node
// seo-lint-changed: runs seo-lint on only the pages a PR changes, so known failures on other pages
// (tracked as seo:refresh issues) don't block unrelated PRs, while every PR must leave the pages it
// touches passing. Run it in CI after the site build.
//
// Usage:
//   node seo-lint-changed.mjs <base-ref> [--config seo.config.yaml] [--out <build output dir>]
//                             [--build-base | --base-dist <base build output dir>]
//
// --base-dist is the site built from <base-ref>. It is passed to seo-lint, which then lets a
// refreshed page over audience.reading_level_max_grade pass when it is at least 1.5 grades below
// its base version; new pages stay held to the cap. Without it, every changed page is held to the
// cap. --build-base makes that base build here: a temporary `git worktree` at <base-ref>, then
// build.install and build.build from seo.config.yaml in it (with this process's environment), and
// <worktree>/<build.output_dir> as --base-dist. It runs only when a published page changed, and the
// worktree is always removed. --base-dist wins when both are given.
// Changed source files map to URL paths through `seo_lint.pages` in seo.config.yaml, a list of
// `{ source, url }` rules where the first matching rule wins:
//   - source: a repo-relative path pattern. `{slug}` matches one path segment, `{path}` one or
//     more segments, `*` anything within a segment, `**` anything.
//   - url: the URL path to lint, with the same placeholders filled in. `''` skips the file;
//     `'*'` lints the whole site (for content kept in one shared file).
// Without `seo_lint.pages`, the rules come from content.dir, content.format and content.url_pattern.
// Part of Jabran's SEO loop (jabranr/skills, skills/jabraf-seo-qa).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from './seo-lint.mjs';

const SEO_LINT = fileURLToPath(new URL('./seo-lint.mjs', import.meta.url));
const FILE_FORMATS = ['md', 'mdx', 'html', 'astro', 'markdoc'];

/**
 * The `{ source, url }` rules for a parsed seo.config.yaml: `seo_lint.pages` when set, otherwise
 * one derived from the content settings. Throws when neither gives a rule.
 */
export function pageRules(cfg) {
  const pages = cfg.seo_lint?.pages;
  if (Array.isArray(pages) && pages.length) return pages;
  const { dir, format, url_pattern: url } = cfg.content ?? {};
  if (dir && url && FILE_FORMATS.includes(format) && /\{(slug|path)\}/.test(url)) {
    const base = String(dir).replace(/\/$/, '');
    return [
      { source: `${base}/{slug}/index.${format}`, url },
      { source: `${base}/{slug}.${format}`, url },
    ];
  }
  throw new Error('seo-lint-changed: set seo_lint.pages in seo.config.yaml (content.* gives no page rule)');
}

function compile(rule) {
  const names = [];
  const pattern = String(rule.source).replace(/\{(slug|path)\}|\*\*|\*|[.+?^$()|[\]\\{}]/g, (m, name) => {
    if (name) {
      names.push(name);
      return name === 'slug' ? '([^/]+)' : '(.+)';
    }
    if (m === '**') return '.*';
    if (m === '*') return '[^/]*';
    return `\\${m}`;
  });
  return { re: new RegExp(`^${pattern}$`), names, url: String(rule.url ?? '') };
}

/**
 * URL paths (as seo-lint names them) of the changed files that are published pages, sorted and
 * unique. `['*']` means lint the whole site.
 */
export function pagesToLint(changedFiles, rules) {
  const compiled = rules.map(compile);
  const pages = new Set();
  for (const file of changedFiles) {
    for (const { re, names, url } of compiled) {
      const m = file.match(re);
      if (!m) continue;
      if (url === '*') return ['*'];
      if (url) pages.add(names.reduce((u, name, i) => u.replaceAll(`{${name}}`, m[i + 1]), url));
      break;
    }
  }
  return [...pages].sort();
}

/**
 * Builds <base> in a temporary git worktree with build.install and build.build, calls `use` with
 * the built output dir, and removes the worktree whatever happens. Returns `use`'s result. Throws
 * when a build command fails.
 */
function withBaseBuild(base, cfg, use) {
  const dir = mkdtempSync(join(tmpdir(), 'seo-lint-base-'));
  const git = (...a) => execFileSync('git', a, { stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    git('worktree', 'add', '--detach', dir, base);
    for (const key of ['install', 'build']) {
      const cmd = cfg.build?.[key];
      if (!cmd) {
        if (key === 'build') throw new Error('build.build is not set in seo.config.yaml');
        continue;
      }
      console.log(`seo-lint-changed: base build (${base}): ${cmd}`);
      const res = spawnSync(String(cmd), { cwd: dir, shell: true, stdio: 'inherit', env: process.env });
      if (res.status !== 0) throw new Error(`build.${key} \`${cmd}\` exited ${res.status ?? res.signal}`);
    }
    return use(join(dir, String(cfg.build?.output_dir ?? 'dist')));
  } finally {
    try {
      git('worktree', 'remove', '--force', dir);
    } catch {
      // The add failed, or the tree is already gone; the rmSync and prune below tidy up.
    }
    rmSync(dir, { recursive: true, force: true });
    spawnSync('git', ['worktree', 'prune'], { stdio: 'ignore' });
  }
}

function main(args) {
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const base = args.find((a, i) => !a.startsWith('--') && !['--config', '--out', '--base-dist'].includes(args[i - 1]));
  const configPath = flag('--config') ?? 'seo.config.yaml';
  const buildBase = args.includes('--build-base') && !args.includes('--base-dist');
  if (!base || !existsSync(configPath)) {
    console.error(
      'usage: seo-lint-changed.mjs <base-ref> [--config seo.config.yaml] [--out <dir>] [--build-base | --base-dist <dir>]'
    );
    process.exit(2);
  }
  const cfg = parseYaml(readFileSync(configPath, 'utf8'));
  const outDir = flag('--out') ?? cfg.build?.output_dir ?? 'dist';
  const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const pages = pagesToLint(changed, pageRules(cfg));
  if (!pages.length) {
    console.log('seo-lint-changed: no published pages changed');
    process.exit(0);
  }
  const run = (baseDist) => {
    const lint = (extra) =>
      spawnSync(
        process.execPath,
        [SEO_LINT, outDir, '--config', configPath, ...(baseDist ? ['--base-dist', baseDist] : []), ...extra],
        { stdio: 'inherit' }
      ).status;
    if (pages[0] === '*') return lint([]) === 0 ? 0 : 1;
    let failed = 0;
    for (const page of pages) if (lint(['--only', page]) !== 0) failed++;
    console.log(`seo-lint-changed: ${pages.length} page(s) checked, ${failed} failed`);
    return failed ? 1 : 0;
  };
  if (!buildBase) process.exit(run(flag('--base-dist')));
  let status;
  try {
    status = withBaseBuild(base, cfg, run);
  } catch (err) {
    console.error(`seo-lint-changed: base build failed: ${err.message}`);
    status = 1;
  }
  process.exit(status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
