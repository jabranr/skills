#!/usr/bin/env node
// seo-lint-changed: runs seo-lint on only the pages a PR changes, so known failures on other pages
// (tracked as seo:refresh issues) don't block unrelated PRs, while every PR must leave the pages it
// touches passing. Run it in CI after the site build.
//
// Usage:
//   node seo-lint-changed.mjs <base-ref> [--config seo.config.yaml] [--out <build output dir>]
//
// Changed source files map to URL paths through `seo_lint.pages` in seo.config.yaml, a list of
// `{ source, url }` rules where the first matching rule wins:
//   - source: a repo-relative path pattern. `{slug}` matches one path segment, `{path}` one or
//     more segments, `*` anything within a segment, `**` anything.
//   - url: the URL path to lint, with the same placeholders filled in. `''` skips the file;
//     `'*'` lints the whole site (for content kept in one shared file).
// Without `seo_lint.pages`, the rules come from content.dir, content.format and content.url_pattern.
// Part of Jabran's SEO loop (jabranr/skills, skills/jabraf-seo-qa).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

function main(args) {
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const base = args.find((a, i) => !a.startsWith('--') && !['--config', '--out'].includes(args[i - 1]));
  const configPath = flag('--config') ?? 'seo.config.yaml';
  if (!base || !existsSync(configPath)) {
    console.error('usage: seo-lint-changed.mjs <base-ref> [--config seo.config.yaml] [--out <dir>]');
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
  const lint = (extra) =>
    spawnSync(process.execPath, [SEO_LINT, outDir, '--config', configPath, ...extra], { stdio: 'inherit' }).status;
  if (pages[0] === '*') process.exit(lint([]) === 0 ? 0 : 1);
  let failed = 0;
  for (const page of pages) if (lint(['--only', page]) !== 0) failed++;
  console.log(`seo-lint-changed: ${pages.length} page(s) checked, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
