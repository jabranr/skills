import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pageRules, pagesToLint } from './seo-lint-changed.mjs';
import { CONFIG, HARD, MEDIUM, writePage } from './seo-lint.fixtures.mjs';
import { parseYaml } from './seo-lint.mjs';

// A static site with pages at the repo root and in folders (the SecureCI layout).
const STATIC = [
  { source: '404.html', url: '' },
  { source: 'index.html', url: '/' },
  { source: 'compare/{slug}.html', url: '/compare/{slug}' },
  { source: 'guides/{slug}.html', url: '/guides/{slug}' },
  { source: '{slug}.html', url: '/{slug}' },
];

test('pagesToLint maps changed page sources to their URL paths', () => {
  assert.deepEqual(
    pagesToLint(['compare/nektos-act.html', 'index.html', 'docs.html', 'guides/pin-actions.html'], STATIC),
    ['/', '/compare/nektos-act', '/docs', '/guides/pin-actions']
  );
});

test('pagesToLint skips files no rule publishes, and rules with an empty url', () => {
  assert.deepEqual(
    pagesToLint(
      ['styles.css', 'assets/logo.svg', 'internal/draft.html', 'README.md', '404.html', 'seo.config.yaml'],
      STATIC
    ),
    []
  );
});

test('pagesToLint dedupes and sorts', () => {
  assert.deepEqual(pagesToLint(['thanks.html', 'compare/a.html', 'thanks.html'], STATIC), ['/compare/a', '/thanks']);
});

test('pagesToLint fills {path} across segments and stops at the first matching rule', () => {
  const rules = [
    { source: 'docs/drafts/**', url: '' },
    { source: 'docs/{path}.md', url: '/docs/{path}/' },
  ];
  assert.deepEqual(pagesToLint(['docs/api/keys.md', 'docs/drafts/next.md'], rules), ['/docs/api/keys/']);
});

test("pagesToLint returns ['*'] when a whole-site rule matches", () => {
  const rules = [{ source: 'apps/web/src/content/*.tsx', url: '*' }];
  assert.deepEqual(pagesToLint(['README.md', 'apps/web/src/content/blog.tsx'], rules), ['*']);
});

test('pageRules reads seo_lint.pages from seo.config.yaml', () => {
  const cfg = parseYaml(
    [
      'seo_lint:',
      '  pages:',
      "    - { source: 'compare/{slug}.html', url: '/compare/{slug}' }",
      "    - { source: '404.html', url: '' }",
    ].join('\n')
  );
  assert.deepEqual(pageRules(cfg), [
    { source: 'compare/{slug}.html', url: '/compare/{slug}' },
    { source: '404.html', url: '' },
  ]);
});

test('pageRules derives rules from content.* for file-per-page formats', () => {
  const rules = pageRules({ content: { dir: 'src/content/blog/', format: 'mdx', url_pattern: '/blog/{slug}/' } });
  assert.deepEqual(pagesToLint(['src/content/blog/hello.mdx', 'src/content/blog/deep/index.mdx'], rules), [
    '/blog/deep/',
    '/blog/hello/',
  ]);
});

test('pageRules throws when content.* cannot map files to pages', () => {
  assert.throws(
    () => pageRules({ content: { dir: 'apps/web/src/content', format: 'tsx', url_pattern: '/blog/{slug}/' } }),
    /set seo_lint\.pages/
  );
});

test('parseYaml reads a cadence ramp written as a list of inline maps', () => {
  const cfg = parseYaml(
    [
      'cadence:',
      '  new_pages_per_week: 2',
      '  ramp:',
      '    - { from: 2026-12-01, new_pages_per_week: 0, refreshes_per_week: 2 }',
      '    - { from: 2027-01-05, new_pages_per_week: 1, weekly_credit_budget: 800 } # comment',
    ].join('\n')
  );
  assert.deepEqual(cfg.cadence.ramp, [
    { from: '2026-12-01', new_pages_per_week: 0, refreshes_per_week: 2 },
    { from: '2027-01-05', new_pages_per_week: 1, weekly_credit_budget: 800 },
  ]);
});

test('parseYaml skips block scalars with chomping indicators', () => {
  for (const indicator of ['|', '>', '|-', '>-', '|+', '>+']) {
    const cfg = parseYaml(
      [
        'goal:',
        '  attribution:',
        `    how_to_query: ${indicator}`,
        '      SELECT first_landing_path: path FROM user',
        '    first_touch_recorded: true',
      ].join('\n')
    );
    assert.deepEqual(cfg.goal.attribution, { how_to_query: '', first_touch_recorded: true }, indicator);
  }
});

const CHANGED = fileURLToPath(new URL('./seo-lint-changed.mjs', import.meta.url));

/**
 * A git repo whose PR branch refreshes blog/old.html (hard → medium, base build in base-dist/) and
 * adds blog/new.html (medium, so over the cap).
 */
function prRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'seo-lint-changed-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  const config = `${CONFIG}\nseo_lint:\n  pages:\n    - { source: 'blog/{slug}.html', url: '/blog/{slug}/' }\n`;
  writeFileSync(join(dir, 'seo.config.yaml'), config);
  mkdirSync(join(dir, 'blog'));
  writeFileSync(join(dir, 'blog/old.html'), 'hard');
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  git('checkout', '-qb', 'pr');
  writeFileSync(join(dir, 'blog/old.html'), 'medium');
  writeFileSync(join(dir, 'blog/new.html'), 'medium');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'pr');
  writePage(join(dir, 'base-dist'), 'old', HARD);
  writePage(join(dir, 'dist'), 'old', MEDIUM);
  writePage(join(dir, 'dist'), 'new', MEDIUM);
  return (...args) => spawnSync(process.execPath, [CHANGED, ...args], { cwd: dir, encoding: 'utf8' });
}

test('seo-lint-changed --base-dist lets a refresh pass by dropping 1.5 grades but fails a new page', () => {
  const res = prRepo()('main', '--config', 'seo.config.yaml', '--base-dist', 'base-dist');
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /\/blog\/old\/\n {2}⚠ reading grade [\d.]+ \(> 8\), base [\d.]+/);
  assert.match(res.stdout, /\/blog\/new\/\n {2}✖ reading grade [\d.]+ \(> 8\)/);
  assert.match(res.stdout, /2 page\(s\) checked, 1 failed/);
});

test('seo-lint-changed without --base-dist keeps the CI call working and holds pages to the cap', () => {
  const res = prRepo()('main', '--config', 'seo.config.yaml');
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /2 page\(s\) checked, 2 failed/);
});
