#!/usr/bin/env node
// seo-lint: deterministic SEO/QA checks over a built static site (no dependencies).
//
// Usage:
//   node seo-lint.mjs <output_dir> [--config seo.config.yaml] [--only /blog/my-post/]
//                     [--base-dist <base build dir>] [--json]
//
// Exit code 1 if any error. Warnings never fail.
// Reading grade over audience.reading_level_max_grade is an error. With --base-dist (the same site
// built from the base ref), a page that also exists there is a refresh: it passes when at least 1.5
// grades below its base grade, and the report names both grades. Pages missing from the base build
// are new and always held to the cap.
// Content pages (matching content.url_pattern) also get reading-level, banned-phrase and
// internal-link checks; every page gets the basic head checks.
// Part of Jabran's SEO loop (jabranr/skills, skills/jabraf-seo-qa). Site settings come from the
// repo's seo.config.yaml; nothing site-specific belongs here.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------- minimal YAML (subset used by seo.config.yaml) ----------
export function parseScalar(raw) {
  let v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']'))
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => parseScalar(s))
      .filter((s) => s !== '');
  if (v.startsWith('{') && v.endsWith('}')) {
    const o = {};
    for (const part of v.slice(1, -1).split(',')) {
      const k = part.indexOf(':');
      if (k > 0) o[part.slice(0, k).trim()] = parseScalar(part.slice(k + 1));
    }
    return o;
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"') q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}
export function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, node: root, key: null, parent: null }];
  let block = null; // skip `|` block scalars
  for (const rawLine of text.split(/\r?\n/)) {
    const indent = rawLine.search(/\S/);
    if (block !== null) {
      if (indent === -1 || indent > block) continue;
      block = null;
    }
    const line = stripComment(rawLine).trimEnd();
    if (!line.trim()) continue;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];
    const t = line.trim();
    if (t.startsWith('- ')) {
      // list item under top.key
      const parent = top.parent;
      if (parent && !Array.isArray(parent[top.key])) parent[top.key] = [];
      if (parent) parent[top.key].push(parseScalar(t.slice(2)));
      continue;
    }
    const k = t.indexOf(':');
    if (k < 0) continue;
    const key = t.slice(0, k).trim();
    const rest = t.slice(k + 1).trim();
    const container = top.node;
    if (/^[|>][-+]?$/.test(rest)) {
      container[key] = '';
      block = indent;
      continue;
    }
    if (rest === '') {
      container[key] = {};
      stack.push({ indent, node: container[key], key, parent: container });
    } else {
      container[key] = parseScalar(rest);
    }
  }
  return root;
}

// ---------- reading level ----------
const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&mdash;|&#8212;|&#x2014;/g, '—');

function mainText(html) {
  const main =
    html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ??
    html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
    html;
  return decode(
    main
      .replace(/<(script|style|pre|code|svg|noscript|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function fkGrade(text) {
  const sentences = text.split(/[.!?]+(?=\s|$)/).filter((s) => s.trim().split(/\s+/).length > 2);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (sentences.length < 5 || words.length < 100) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

/**
 * Flesch-Kincaid grade of a built page's main text, or null when the text is too short to judge.
 */
export function readingGrade(html) {
  return fkGrade(mainText(html));
}

/**
 * The reading-grade rule. A page over `maxGrade` fails, unless it is a refresh (`baseGrade` is the
 * same page's grade on the base build) that lands at least 1.5 grades below the base, so old pages
 * above the cap can come down a step at a time. `baseGrade` undefined means a new page or no base
 * build; null means the base page was too short to grade, so the cap applies. Returns `{ error }`,
 * `{ warning }` (passes, naming both grades) or `{}`.
 */
export function gradeVerdict({ grade, baseGrade, maxGrade }) {
  if (grade === null || grade === undefined || grade <= maxGrade) return {};
  const now = `reading grade ${grade.toFixed(1)} (> ${maxGrade})`;
  if (baseGrade === undefined) return { error: now };
  if (baseGrade === null) return { error: `${now}, base not measurable` };
  const both = `${now}, base ${baseGrade.toFixed(1)}`;
  // Compare the rounded figures the report shows, so 12.0 → 10.5 passes as it reads.
  const drop = Math.round(baseGrade * 10) - Math.round(grade * 10);
  return drop >= 15
    ? { warning: `${both}: refresh lowers it ${(drop / 10).toFixed(1)} grades, passes` }
    : { error: `${both}: a refresh must reach ${maxGrade} or drop 1.5 grades` };
}

function main(args) {
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const outDir = args.find(
    (a, i) => !a.startsWith('--') && !['--config', '--only', '--base-dist'].includes(args[i - 1])
  );
  const baseDist = flag('--base-dist');
  if (!outDir || !existsSync(outDir) || (baseDist !== undefined && !existsSync(baseDist))) {
    console.error(
      'usage: seo-lint.mjs <output_dir> [--config seo.config.yaml] [--only <path>] [--base-dist <dir>] [--json]'
    );
    process.exit(2);
  }
  const configPath = flag('--config') ?? (existsSync('seo.config.yaml') ? 'seo.config.yaml' : undefined);
  const only = flag('--only');
  const asJson = args.includes('--json');

  const cfg = configPath ? parseYaml(readFileSync(configPath, 'utf8')) : {};
  const baseUrl = String(cfg.site?.base_url ?? '').replace(/\/$/, '');
  const trailingSlash = cfg.site?.trailing_slash;
  const maxGrade = Number(cfg.audience?.reading_level_max_grade ?? 8);
  const banned = (Array.isArray(cfg.voice?.banned_phrases) ? cfg.voice.banned_phrases : []).map(String);
  const minLinks = Number(cfg.content?.internal_links_min ?? 3);
  const contentPrefix = String(cfg.content?.url_pattern ?? '').split('{')[0] || null;
  const ctaUrl = cfg.goal?.cta?.primary_url;

  // ---------- files ----------
  function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) out.push(...walk(p));
      else if (name.endsWith('.html')) out.push(p);
    }
    return out;
  }
  function urlPathFor(file) {
    let rel = '/' + relative(outDir, file).split(sep).join('/');
    if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
    else rel = rel.replace(/\.html$/, '');
    return rel;
  }
  let files = walk(outDir).filter((f) => !/\/(404|500)(\/index)?\.html$/.test(f));
  if (only) {
    const norm = (p) => p.replace(/\/$/, '');
    files = files.filter((f) => norm(urlPathFor(f)) === norm(only));
    if (!files.length) {
      console.error(`seo-lint: no built file for ${only}`);
      process.exit(1);
    }
  }

  // ---------- helpers ----------
  const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : undefined;
  };
  const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
  // ---------- checks ----------
  const results = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const path = urlPathFor(file);
    const errors = [];
    const warnings = [];
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    const metas = tags(head, 'meta');
    const metaBy = (n) => metas.find((m) => (attr(m, 'name') ?? attr(m, 'property'))?.toLowerCase() === n);

    const robots = attr(metaBy('robots') ?? '', 'content') ?? '';
    if (/noindex/i.test(robots)) {
      results.push({ path, skipped: 'noindex', errors, warnings });
      continue;
    }

    if (!/<html\b[^>]*\slang=/i.test(html)) warnings.push('missing <html lang>');

    const title = decode(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
    if (!title) errors.push('missing <title>');
    else if (title.length > 60) warnings.push(`title ${title.length} chars (>60)`);
    else if (title.length < 15) warnings.push(`title ${title.length} chars (<15)`);

    const desc = attr(metaBy('description') ?? '', 'content')?.trim() ?? '';
    if (!desc) errors.push('missing meta description');
    else if (desc.length > 160) warnings.push(`meta description ${desc.length} chars (>160)`);
    else if (desc.length < 50) warnings.push(`meta description ${desc.length} chars (<50)`);

    const h1s = tags(html, 'h1').length;
    if (h1s !== 1) errors.push(`${h1s} <h1> elements (want 1)`);

    const canonTag = tags(head, 'link').find((l) => attr(l, 'rel')?.toLowerCase() === 'canonical');
    const canonical = canonTag ? attr(canonTag, 'href') : undefined;
    if (!canonical) errors.push('missing canonical');
    else {
      if (baseUrl && !canonical.startsWith(baseUrl)) errors.push(`canonical not on ${baseUrl}: ${canonical}`);
      const cPath = canonical.replace(/^https?:\/\/[^/]+/, '') || '/';
      if (/[?#]/.test(canonical)) errors.push(`canonical has query/fragment: ${canonical}`);
      if (trailingSlash === true && !cPath.endsWith('/') && !/\.[a-z0-9]+$/i.test(cPath))
        errors.push(`canonical lacks trailing slash: ${canonical}`);
      if (trailingSlash === false && cPath !== '/' && cPath.endsWith('/'))
        errors.push(`canonical has trailing slash: ${canonical}`);
    }

    if (!metaBy('og:title')) warnings.push('missing og:title');
    if (!metaBy('og:description')) warnings.push('missing og:description');

    for (const img of tags(html, 'img')) {
      if (attr(img, 'alt') === undefined) errors.push(`img without alt: ${attr(img, 'src') ?? '?'}`);
    }

    for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        JSON.parse(m[1]);
      } catch {
        errors.push('invalid JSON-LD');
      }
    }

    if (typeof trailingSlash === 'boolean') {
      const offForm = new Set(
        tags(html, 'a')
          .map((a) => attr(a, 'href') ?? '')
          .map((h) => (baseUrl && h.startsWith(baseUrl) ? h.slice(baseUrl.length) || '/' : h))
          .filter((h) => h.startsWith('/') && !h.startsWith('//'))
          .map((h) => h.split(/[?#]/)[0])
          .filter((h) => h !== '/' && !/\.[a-z0-9]+$/i.test(h) && !h.startsWith('/api/'))
          .filter((h) => (trailingSlash ? !h.endsWith('/') : h.endsWith('/')))
      );
      if (offForm.size)
        warnings.push(
          `${offForm.size} internal link(s) not in canonical ${trailingSlash ? 'trailing-slash' : 'no-slash'} form: ${[...offForm].slice(0, 5).join(', ')}`
        );
    }

    const isContent = contentPrefix && path.startsWith(contentPrefix) && path !== contentPrefix;
    if (isContent) {
      const text = mainText(html);
      const lower = text.toLowerCase();
      for (const p of banned) if (p && lower.includes(p.toLowerCase())) errors.push(`banned phrase: "${p}"`);
      const grade = fkGrade(text);
      const baseFile = baseDist && join(baseDist, relative(outDir, file));
      const baseGrade = baseFile && existsSync(baseFile) ? readingGrade(readFileSync(baseFile, 'utf8')) : undefined;
      const verdict = gradeVerdict({ grade, baseGrade, maxGrade });
      if (verdict.error) errors.push(verdict.error);
      if (verdict.warning) warnings.push(verdict.warning);
      const main = html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? html;
      const hrefs = tags(main, 'a').map((a) => attr(a, 'href') ?? '');
      const internal = new Set(
        hrefs
          .filter((h) => (h.startsWith('/') && !h.startsWith('//')) || (baseUrl && h.startsWith(baseUrl)))
          .map((h) => h.replace(baseUrl, '').split('#')[0])
          .filter((h) => h && h !== path)
      );
      if (internal.size < minLinks) warnings.push(`${internal.size} internal links in content (< ${minLinks})`);
      if (ctaUrl && !hrefs.some((h) => h.replace(baseUrl, '').startsWith(ctaUrl)))
        warnings.push(`no link to CTA ${ctaUrl}`);
      const words = text.split(/\s+/).length;
      const minW = Number(cfg.content?.min_words ?? 0);
      if (minW && words < minW) warnings.push(`${words} words (< ${minW})`);
    }

    results.push({ path, errors, warnings });
  }

  // ---------- duplicates ----------
  const byTitle = new Map();
  const byDesc = new Map();
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const t = decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
    const p = urlPathFor(file);
    if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), p]);
    const d = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0];
    const dc = d ? attr(d, 'content') : '';
    if (dc) byDesc.set(dc, [...(byDesc.get(dc) ?? []), p]);
  }
  const dupes = [];
  for (const [t, ps] of byTitle) if (ps.length > 1) dupes.push(`duplicate title "${t}": ${ps.join(', ')}`);
  for (const [, ps] of byDesc) if (ps.length > 1) dupes.push(`duplicate meta description: ${ps.join(', ')}`);

  // ---------- report ----------
  const errorCount = results.reduce((n, r) => n + r.errors.length, 0);
  const warnCount = results.reduce((n, r) => n + r.warnings.length, 0) + dupes.length;
  if (asJson) {
    console.log(JSON.stringify({ errorCount, warnCount, results, duplicates: dupes }, null, 2));
  } else {
    for (const r of results) {
      if (r.skipped) continue;
      if (!r.errors.length && !r.warnings.length) continue;
      console.log(`\n${r.path}`);
      for (const e of r.errors) console.log(`  ✖ ${e}`);
      for (const w of r.warnings) console.log(`  ⚠ ${w}`);
    }
    if (dupes.length) {
      console.log('\nsite-wide');
      for (const d of dupes) console.log(`  ⚠ ${d}`);
    }
    console.log(`\nseo-lint: ${results.length} page(s), ${errorCount} error(s), ${warnCount} warning(s)`);
  }
  process.exit(errorCount ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
