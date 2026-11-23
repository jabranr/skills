---
name: jabraf-seo-writer
description: Writes or rewrites one page for Jabran's SEO loop from a GitHub issue labelled seo:qa-failed, seo:refresh or seo:brief, on a branch, and opens or updates a draft PR. Respects the effective weekly cadence and never merges. Load when asked to write the next SEO page or work an SEO issue on a repo with seo.config.yaml, or by its writer scheduled task.
---

# `jabraf-seo-writer`

One issue per run. The draft PR it opens goes to `jabraf-seo-qa`; this skill never merges.

**Effective cadence:** the `cadence.ramp` entry with the latest `from` on or before today
overrides `cadence.new_pages_per_week` and `cadence.refreshes_per_week`; a key it leaves out keeps
the base value.

## Pick work

Priority:

1. `seo:qa-failed`, oldest first.
2. `seo:refresh`, while fewer refresh PRs than the effective `refreshes_per_week` were opened this
   ISO week.
3. `seo:brief`, highest score first, while fewer new-page PRs than the effective
   `new_pages_per_week` were opened this ISO week. At 0, briefs wait.

Skip issues labelled `seo:needs-human`. Nothing eligible: comment one line on the tracking issue
`SEO loop — tracking` and stop. Read the chosen issue, every comment and, for `seo:qa-failed`, the
latest `SEO-QA round` review on its PR.

## Prepare

- Read `seo.config.yaml`, the repo's AGENTS.md and CLAUDE.md (tests, flags, lint and commit rules
  win), and the writing preferences in `get_project_context`.
- Read 2 existing pages of the same type to match structure, components and tone.
- Read every file the brief cites as a fact source. A needed fact that no source holds: comment on
  the issue with what is missing, label it `seo:needs-human`, and stop.

## Write

- Branch `{github.branch_prefix}{issue}-{slug}` from `github.base_branch`; reuse it for
  `seo:qa-failed`.
- Follow `content.new_page_steps` exactly. Use the repo's components and design tokens.
- Answer the query in the first 100 words. One idea per paragraph, short sentences, reading level
  at or below `audience.reading_level_max_grade`. Follow `voice` (tone, person, `brand_name_rule`,
  `rules`) and use none of `voice.banned_phrases` or `facts.forbidden_claims`.
- Deliver the brief's unique value with real material: working code tested against the real API,
  images per `content.images`, data with its source. Screenshots, quotes, testimonials, stats and
  customer names all come from real sources.
- Links: the brief's internal links, plus the inbound links from the existing pages it lists.
  External links go to primary sources.
- CTA per the brief. Metadata (title, description, canonical in the `site.trailing_slash` form),
  schema per the brief, alt text on every image.
- Refreshes keep the URL and change what the issue asks for, leaving what already ranks. Note the
  change in the PR.

## Verify

Run `build.build`, `build.test` and `build.lint`, then seo-lint on the page. The lint script lives
in `jabraf-seo-qa`; fetch it from the same ref this skill was loaded from (`seo-loop-v1` for
scheduled tasks, `main` when installed locally):

```bash
curl -fsSL https://raw.githubusercontent.com/jabranr/skills/<ref>/skills/jabraf-seo-qa/scripts/seo-lint.mjs -o "${TMPDIR:-/tmp}/seo-lint.mjs"
node "${TMPDIR:-/tmp}/seo-lint.mjs" {build.output_dir} --config seo.config.yaml --only {url}
```

Done when every command exits 0. Add or update the tests the repo rules require (such as content
catalogue specs).

## PR

Open (or update) a **draft** PR titled "SEO: {title}" with `Closes #{issue}`, the target query,
intent, unique value, fact sources used, links added and the lint output. Label the issue
`seo:drafting` and remove `seo:brief`, `seo:refresh` and `seo:qa-failed`. Commit messages follow
the repo rules.
