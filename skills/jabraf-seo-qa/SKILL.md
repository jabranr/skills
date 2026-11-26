---
name: jabraf-seo-qa
description: Independent QA for Jabran's SEO loop. Reviews draft PRs whose issues are labelled seo:drafting, passes them or sends them back, then squash-merges passed PRs when every merge gate in seo.config.yaml auto_merge holds, promotes to production when configured, and publishes. Also holds the seo-lint scripts. Load when asked to QA, review or merge the SEO PRs on a repo with seo.config.yaml, or by its QA scheduled task.
---

# `jabraf-seo-qa`

Act as a strict editor who did not write the page. Each run:

1. Review every open PR whose issue is labelled `seo:drafting`.
2. Re-check every open PR whose issue is labelled `seo:review` against the merge gates (CI may have
   been pending last run).
3. Merge, promote and publish as below.

Load `jabraf-seo-publish` the way this skill was loaded (the same `npx -y skills@1.5.12 use` URL
and ref, skill name swapped) when you reach Publish.

## Checks (all must pass)

**Deterministic.** Build with `build.build`, then run
`node scripts/seo-lint.mjs {build.output_dir} --config seo.config.yaml --only {url}`, where
`scripts/` is this skill's directory. Any error fails. For a refresh, also build the PR's base
(`git worktree add <tmp> origin/{github.base_branch}`, then `build.build` there) and add
`--base-dist <tmp>/{build.output_dir}`, so the reading-grade rule below can compare against it.

**Facts.** Every product claim traces to a file in `facts.sources` or a cited primary URL. Prices,
limits, features, hours and areas match the source _today_. Nothing in `facts.forbidden_claims`,
read as meaning rather than substring (a correct negation passes). Code samples run against the
real API or format (ids, endpoints, field names). Any doubt fails.

**Intent and value.** The first 100 words answer the target query. The page matches the brief's
intent and type. The unique value is there. It beats the top results on at least one clear
dimension. Thin or generic fails.

**Reader.** Reading level: a new page at or below `audience.reading_level_max_grade` (hard fail
otherwise). A refresh passes when it is at or below the cap, or at least 1.5 grades below the base
version, so a page that was already over the cap can come down in steps; report both grades
(seo-lint's `reading grade X (> cap), base Y` line) in the QA comment. No banned phrases; sounds
like `voice` and follows `voice.rules` and `voice.brand_name_rule`; direct openings, each point
made once, plain confident sentences with no AI tone (stacked hedges, reflexive triplets, empty
summaries).

**SEO.** Title and description per the brief; one H1; logical H2 and H3s; canonical in the
`site.trailing_slash` form; schema valid for the type; internal links present (including
`content.must_link_to` where relevant) and the inbound links added; no cannibalisation (check GSC
`['query','page']` for the target query).

**Conversion.** CTA present, contextual, matches `goal.preset`, and its links resolve.

**Brand and accessibility.** Repo components and tokens; alt text; real, relevant images.
Screenshot the page (Playwright against `build.preview`, or the PR preview URL) at mobile and
desktop width and look at both.

**Repo rules.** Tests, lint and typecheck pass; required tests added; nothing generated or secret
committed.

## Outcome

- **Pass:** mark the PR ready for review, label the issue `seo:review`, and comment a short
  checklist summary starting `SEO-QA pass`. Go to Merge.
- **Fail:** a review comment starting `SEO-QA round N` listing each failure with its exact fix.
  N below `cadence.qa_max_rounds`: label `seo:qa-failed`. Otherwise label `seo:needs-human` with a
  summary of what keeps failing.

## Merge

Only when `auto_merge.enabled` is true; otherwise stop at Pass and a human merges. Re-check every
gate right before merging:

1. QA passed on the PR's current head commit (nothing pushed since your `SEO-QA pass`).
2. Every CI check on that head is green. Pending: wait up to `auto_merge.ci_wait_minutes`
   (default 20), then leave it labelled `seo:review` for the next run.
3. GitHub reports it mergeable into `github.base_branch`, with no conflicts.
4. No unresolved review threads and no outstanding "changes requested" review.
5. Every changed file matches `auto_merge.allowed_paths`.

All hold: merge with `auto_merge.method` (default squash), using the PR title as the commit title,
and comment `SEO-QA merged` with the merge SHA. Any gate other than pending CI fails: leave it
unmerged, label the issue `seo:needs-human`, and comment which gate failed and why.

Merges go through GitHub's merge with branch protection and required reviews intact: no admin
merge, no force-push, and no direct push to `github.base_branch`.

## Promote

Only when `auto_merge.promote.enabled` is true (a merge to `github.base_branch` deploys staging
only). Run once, after all merges, when this run merged something or a merged `seo:review` PR is
not live yet:

1. Wait up to `promote.staging_wait_minutes` for staging to be ready for the last merge commit, as
   `promote.staging_ready` describes.
2. Read the live commit from `promote.live_version_selector` on `site.base_url`. Already that merge
   commit: skip to Publish. Otherwise list the commits from the live one to the merge commit.
   Promote only when every one squashes a PR from a `github.branch_prefix` branch and changes only
   files matching `auto_merge.allowed_paths`. Any other commit: leave production alone, comment on
   the tracking issue `SEO loop — tracking` how many non-SEO commits wait for a manual promotion,
   and leave publishing pending.
3. Dispatch `promote.workflow` with `promote.workflow_inputs` (`{sha}` replaced by the merge commit
   SHA) and wait up to `promote.run_timeout_minutes` for it to finish. Success means the run passed
   and the live version is that commit.
4. Staging not ready in time, or the promotion fails: stop without publishing or retrying. Label
   the issues `seo:needs-human` and comment the failing run's link.

## Publish

After merging (and, when promotion is enabled, after Promote succeeds), follow
`jabraf-seo-publish` for every merged PR whose issue is still `seo:review`, this run's merges and
earlier ones. Wait up to `publish.deploy_wait_minutes` for this run's pages to go live first. Pages
still not live on `site.base_url` stay `seo:review`; the next run retries them.

## Scripts

- [`scripts/seo-lint.mjs`](scripts/seo-lint.mjs): checks built HTML (title, description, one H1,
  canonical form, alt text, JSON-LD, and for content pages banned phrases, reading grade, internal
  links, CTA link, word count). Errors exit 1; warnings never fail. `--base-dist <dir>` (the site
  built from the base ref) applies the refresh rule to reading grade: a page also in the base
  build passes when 1.5 or more grades below its base grade (a warning naming both); pages missing
  there are new and held to the cap. Without it, every page is held to the cap.
- [`scripts/seo-lint-changed.mjs`](scripts/seo-lint-changed.mjs):
  `<base-ref> [--config] [--out] [--base-dist]`; lints only the pages changed since the base ref,
  mapped through `seo_lint.pages` (or `content.*`), passing `--base-dist` on to seo-lint. Used in
  CI; see `jabraf-seo-setup` for the pinned fetch step.

Both need Node 18 or newer and no dependencies. Tests: `npm test` in `jabranr/skills`.
