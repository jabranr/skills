import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONFIG, EASY, HARD, MEDIUM, page, writePage } from './seo-lint.fixtures.mjs';
import { gradeVerdict, readingGrade } from './seo-lint.mjs';

const SEO_LINT = fileURLToPath(new URL('./seo-lint.mjs', import.meta.url));

test('fixtures span the cap: easy at or below 8, medium and hard above, hard well above medium', () => {
  const grade = (text) => readingGrade(page('x', text));
  assert.ok(grade(EASY) <= 8, `easy ${grade(EASY)}`);
  assert.ok(grade(MEDIUM) > 8, `medium ${grade(MEDIUM)}`);
  assert.ok(grade(HARD) - grade(MEDIUM) >= 1.5, `hard ${grade(HARD)} vs medium ${grade(MEDIUM)}`);
});

test('gradeVerdict: a new page over the cap is an error', () => {
  assert.match(gradeVerdict({ grade: 9.2, maxGrade: 8 }).error, /reading grade 9\.2 \(> 8\)/);
  assert.deepEqual(gradeVerdict({ grade: 7.9, maxGrade: 8 }), {});
  assert.deepEqual(gradeVerdict({ grade: null, maxGrade: 8 }), {});
});

test('gradeVerdict: a refresh at or below the cap passes', () => {
  assert.deepEqual(gradeVerdict({ grade: 8, baseGrade: 12, maxGrade: 8 }), {});
});

test('gradeVerdict: a refresh over the cap passes when 1.5 or more grades below the base, naming both', () => {
  const v = gradeVerdict({ grade: 10.5, baseGrade: 12, maxGrade: 8 });
  assert.equal(v.error, undefined);
  assert.match(v.warning, /reading grade 10\.5 \(> 8\), base 12\.0/);
});

test('gradeVerdict: a refresh over the cap fails when less than 1.5 below the base, naming both', () => {
  const v = gradeVerdict({ grade: 10.6, baseGrade: 12, maxGrade: 8 });
  assert.match(v.error, /reading grade 10\.6 \(> 8\), base 12\.0/);
  assert.match(gradeVerdict({ grade: 13, baseGrade: 12, maxGrade: 8 }).error, /base 12\.0/);
});

test('gradeVerdict: a refresh whose base grade cannot be measured is held to the cap', () => {
  assert.match(gradeVerdict({ grade: 9, baseGrade: null, maxGrade: 8 }).error, /reading grade 9\.0 \(> 8\)/);
});

test('seo-lint --base-dist passes a refresh that drops 1.5 grades and fails a new page over the cap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seo-lint-'));
  writeFileSync(join(dir, 'seo.config.yaml'), CONFIG);
  writePage(join(dir, 'dist'), 'old', MEDIUM);
  writePage(join(dir, 'base'), 'old', HARD);
  writePage(join(dir, 'dist'), 'new', MEDIUM);
  const res = spawnSync(
    process.execPath,
    [SEO_LINT, join(dir, 'dist'), '--config', join(dir, 'seo.config.yaml'), '--base-dist', join(dir, 'base')],
    { encoding: 'utf8' }
  );
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /\/blog\/old\/\n {2}⚠ reading grade [\d.]+ \(> 8\), base [\d.]+/);
  assert.match(res.stdout, /\/blog\/new\/\n {2}✖ reading grade [\d.]+ \(> 8\)/);
});

test('seo-lint --base-dist fails a refresh that stays over the cap without dropping 1.5 grades', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seo-lint-'));
  writeFileSync(join(dir, 'seo.config.yaml'), CONFIG);
  writePage(join(dir, 'dist'), 'old', MEDIUM);
  writePage(join(dir, 'base'), 'old', MEDIUM);
  const res = spawnSync(
    process.execPath,
    [SEO_LINT, join(dir, 'dist'), '--config', join(dir, 'seo.config.yaml'), '--base-dist', join(dir, 'base')],
    { encoding: 'utf8' }
  );
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /✖ reading grade [\d.]+ \(> 8\), base [\d.]+/);
});

test('seo-lint without --base-dist holds every content page to the cap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seo-lint-'));
  writeFileSync(join(dir, 'seo.config.yaml'), CONFIG);
  writePage(join(dir, 'dist'), 'easy', EASY);
  assert.equal(
    spawnSync(process.execPath, [SEO_LINT, join(dir, 'dist'), '--config', join(dir, 'seo.config.yaml')]).status,
    0
  );
  writePage(join(dir, 'dist'), 'old', MEDIUM);
  const res = spawnSync(process.execPath, [SEO_LINT, join(dir, 'dist'), '--config', join(dir, 'seo.config.yaml')], {
    encoding: 'utf8',
  });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /✖ reading grade [\d.]+ \(> 8\)\n/);
});
