// Shared fixtures for the seo-lint tests: built pages with a known reading grade.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Reading-level fixtures (grades about 1.3, 9.7 and 13.5): each sentence repeated so the text clears fkGrade's minimum length.
const repeat = (sentence, n = 12) => Array.from({ length: n }, () => sentence).join(' ');
export const EASY = repeat('The cat sat on the mat and we had fun all day long.');
export const MEDIUM = repeat(
  'Our team builds simple tools that help small shops publish their pages faster, and we support them by email every single day of the week.'
);
export const HARD = repeat(
  'Our team builds practical publishing tools that help independent businesses manage their websites without technical knowledge.'
);

export function page(slug, text) {
  return [
    '<!doctype html><html lang="en"><head>',
    `<title>Fixture page about ${slug}</title>`,
    '<meta name="description" content="A fixture page used to test the reading grade rule in seo-lint.">',
    `<meta property="og:title" content="${slug}"><meta property="og:description" content="${slug}">`,
    `<link rel="canonical" href="https://example.com/blog/${slug}/">`,
    `</head><body><main><h1>${slug}</h1><p>${text}</p></main></body></html>`,
  ].join('\n');
}

export function writePage(dist, slug, text) {
  const file = join(dist, 'blog', slug, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(slug, text));
}

export const CONFIG = [
  'site:',
  '  base_url: https://example.com',
  'audience:',
  '  reading_level_max_grade: 8',
  'content:',
  "  url_pattern: '/blog/{slug}/'",
  '  internal_links_min: 0',
].join('\n');
