---
name: jabraf-seo-setup
description: One-off onboarding of a repo into Jabran's SEO loop (the jabraf-seo-* skills, run by Claude Code scheduled tasks with the OpenSEO MCP). Fills seo.config.yaml, syncs OpenSEO context, takes a free baseline, creates labels and a rank tracker, checks attribution and proposes the schedules. Load when asked to set up or onboard a site to Jabran's SEO loop, to migrate a repo off the old Automated SEO Kit copies, or to create its SEO scheduled tasks.
---

# `jabraf-seo-setup`

Leaves a repo ready for the weekly loop. Ask the user for anything you cannot infer, and validate
your inferences with them. Spend OpenSEO credits only after showing the estimate and getting a yes.

## The loop

Research finds opportunities and opens `seo:brief` issues. The writer turns one issue into a draft
PR. QA reviews it, sends it back (`seo:qa-failed`) or passes it (`seo:review`), then merges it when
every merge gate holds and publishes it. Audit turns existing pages into `seo:refresh` and
`seo:technical` issues, which take the same writer, QA, publish path. Conversion learns which pages
convert and feeds weights back to research.

| Skill                   | Run by          | Output                                    |
| ----------------------- | --------------- | ----------------------------------------- |
| `jabraf-seo-research`   | weekly task     | `seo:brief` issues                        |
| `jabraf-seo-brief`      | research, audit | one brief in the issue template's shape   |
| `jabraf-seo-writer`     | writer task     | a draft PR, issue `seo:drafting`          |
| `jabraf-seo-qa`         | QA task         | pass, fail, merge, promote, publish       |
| `jabraf-seo-publish`    | daily task, QA  | indexing submitted, issue `seo:published` |
| `jabraf-seo-audit`      | weekly task     | `seo:refresh` and `seo:technical` issues  |
| `jabraf-seo-conversion` | monthly task    | a weights PR and a report                 |

Labels and colours: [`templates/seo-labels.json`](templates/seo-labels.json). Issue shapes:
the `templates/` directory of `jabraf-seo-brief` (load it the way this skill was loaded, skill
name swapped, to read them). Every config key is described
in [`seo.config.example.yaml`](seo.config.example.yaml).

Each skill posts its run summary on the repo's pinned tracking issue, titled exactly
`SEO loop — tracking`.

## What the repo keeps

- `seo.config.yaml` at the root: every site-specific setting.
- The AGENTS.md pointer block below.
- Optionally, a CI step that fetches the lint scripts pinned to a commit SHA.

Skills, templates and lint scripts stay in `jabranr/skills`. A repo holds no `.claude/skills/seo-*`
copies, so a fix lands once, upstream, and reaches every site when the pin moves.

### AGENTS.md pointer block

```md
## SEO loop

This repo runs Jabran's SEO loop. Its settings are in [`seo.config.yaml`](seo.config.yaml); the
`jabraf-seo-*` skills live in [`jabranr/skills`](https://github.com/jabranr/skills/tree/main/skills).
Scheduled tasks load them pinned to a tag. To run a step by hand, load the skill with
`npx -y skills@1.5.12 use https://github.com/jabranr/skills/tree/seo-loop-v1/skills/<skill>` and
follow it for this repo. Change site behaviour in `seo.config.yaml` and loop behaviour upstream in
the skills; this repo keeps no copies of them. The rules in this file win over the skills.
```

## Goal presets

The preset sets the north star, the conversion events, the CTA style and the page types research
favours. Write the chosen values into `goal.*` and `content.page_types`.

| Preset     | North star                                 | Conversion events                         | Favoured page types                                                  | CTA                              |
| ---------- | ------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `saas`     | Activated accounts from organic            | `signup`, `activated` (first real value)  | alternatives and vs, integration and framework guides, use cases     | contextual "do this now", signup |
| `local`    | Calls and booking or enquiry submissions   | `call_click`, `enquiry_submit`, `booking` | service by area, event or occasion, pricing, galleries, FAQs         | phone, WhatsApp, book or enquire |
| `content`  | Email signups, or ad and affiliate revenue | `newsletter_signup`, `affiliate_click`    | calculators and tools, explainers that answer a question, data pages | newsletter or tool use, inline   |
| `personal` | Inbound leads and contact                  | `contact_submit`, `booking`               | case studies, expertise articles, "hire X for Y"                     | contact or book a call           |

Clicks are a leading signal; work is ranked by expected conversions. Until about 20 real
conversions exist, `goal.proxy_event` stands in. Local sites also keep the Google Business Profile
in step (`get_business_profile`, local rank grid): the local pack beats blog posts for most service
queries. Plan on about 3 months before judging conversions; judge indexing and impressions sooner.

## Steps

1. **Read rules.** The repo's AGENTS.md, CLAUDE.md and README. They win over these skills.

2. **OpenSEO project.** `list_projects`, match `site.domain`. None: stop and ask the user to create
   it (it needs the domain). Then `list_search_console_sites` for that project: one property must
   have `isSelected: true` and `requiresReconnect: false`. Report the bound property. Unbound: ask
   before calling `set_search_console_site`.

3. **Fill `seo.config.yaml`** (start from [`seo.config.example.yaml`](seo.config.example.yaml) if
   missing). Infer from the code: content dir and format, how a new page is added (read 2 existing
   pages and the router or sitemap code), `url_pattern`, trailing-slash form, build, test and lint
   commands, output dir, money pages, fact sources, and the deploy path (does a merge to
   `base_branch` deploy production, or staging plus a promote workflow; how long a deploy takes for
   `publish.deploy_wait_minutes`). Ask the user for: `goal.preset`, `north_star`, conversion event
   names, `audience`, `voice` (including `voice.rules` and `facts.forbidden_claims`), competitors,
   weekly credit budget, whether `auto_merge` is on and its `allowed_paths`, and the starting
   cadence (`cadence.ramp` for a dated ramp; `new_pages_per_week: 0` for a refresh-only start).
   Done when every key in the example is set or deliberately empty.

4. **Sync OpenSEO context.** `get_project_context`; fill missing sections with
   `update_project_context`: business_overview, current_goal (north star and a 90-day target),
   positioning, writing_preferences (voice, banned phrases, reading level), competitors, key pages
   (money pages). `research_project_website` only after showing its cost and getting a yes.

5. **Baseline (free calls only).**
   - `get_search_console_performance` last_3_months by `page` and by `query`: note top pages and
     striking-distance queries (position 5 to 20, 50+ impressions; lower the bar for new sites).
   - URL-variant duplicates (trailing slash, `#fragment`, `?query`) and app or auth pages (login,
     dashboard) getting impressions: open `seo:technical` issues.
   - `inspect_urls` on the home page and the top 5 money pages.

   Create and pin the tracking issue `SEO loop — tracking` if missing, and post the baseline as
   its first comment.

6. **Labels.** Create every label in [`templates/seo-labels.json`](templates/seo-labels.json),
   skipping ones that exist.

7. **Rank tracker.** Propose 20 to 40 keywords (GSC queries, preset page types, competitors).
   `estimate_rank_tracker_cost`, show the cost, and wait for the user's yes. Then
   `create_rank_tracker` and `add_rank_tracking_keywords`, and save the id in
   `openseo.rank_tracker_id`.

8. **Attribution check.** Find where `goal.conversion_events` are recorded (analytics code, DB
   tables, API) and whether the first landing path and referrer are stored on the conversion. Not
   stored: open a `seo:technical` issue describing first-touch attribution for this stack (capture
   on the first pageview in first-party storage, attach at conversion, query page to conversion),
   respecting the repo rules (feature flags, tests). Set `goal.attribution.first_touch_recorded`
   and `how_to_query` to match what you found.

9. **CI lint (suggest).** Offer the CI step below. Commit or push only when the repo rules and the
   user allow it.

10. **Schedules.** Propose the tasks below with times. Create them only after the user's yes.

11. **Report** what was set up, what is blocked, and which tasks exist.

## CI lint step

`seo-lint-changed.mjs` lints only the pages a PR changes, so known failures elsewhere (already
`seo:refresh` issues) do not block unrelated PRs. It maps changed files to pages through
`seo_lint.pages`, or through `content.*` for one-file-per-page formats. Pin `SKILLS_SHA` to a full
40-character commit SHA of `jabranr/skills` (resolve it from the `seo-loop-v1` tag:
`git ls-remote https://github.com/jabranr/skills refs/tags/seo-loop-v1`), and move it on purpose.

```yaml
- uses: actions/checkout@<sha> # vX
  with:
    fetch-depth: 0 # seo-lint-changed diffs against the base branch

# ... install and build steps ...

- name: Fetch seo-lint
  env:
    SKILLS_SHA: <40-char commit SHA of jabranr/skills>
  run: |
    mkdir -p "$RUNNER_TEMP/seo-lint"
    for f in seo-lint.mjs seo-lint-changed.mjs; do
      curl -fsSL "https://raw.githubusercontent.com/jabranr/skills/${SKILLS_SHA}/skills/jabraf-seo-qa/scripts/$f" \
        -o "$RUNNER_TEMP/seo-lint/$f"
    done

- name: seo-lint changed pages
  env:
    BASE_REF: ${{ github.base_ref }}
  run: node "$RUNNER_TEMP/seo-lint/seo-lint-changed.mjs" "origin/$BASE_REF" --config seo.config.yaml
```

The step needs Node 18 or newer and no install. With `auto_merge.enabled`, this CI run is one of the
checks QA requires green before it merges.

## Schedules

Create one set per repo as Claude Code scheduled tasks, each starting a fresh session in that
repo's environment with the OpenSEO connector. Every task loads its skill pinned to the
`seo-loop-v1` tag, so a push to `main` changes no running loop until the pin moves:

```bash
npx -y skills@1.5.12 use https://github.com/jabranr/skills/tree/seo-loop-v1/skills/<skill>
```

Prompt template for every task:

```text
Load <skill> with `npx -y skills@1.5.12 use https://github.com/jabranr/skills/tree/seo-loop-v1/skills/<skill>` and follow it for <owner/repo> per seo.config.yaml.
```

| Task                   | Skill                   | Cron (example, local time)   |
| ---------------------- | ----------------------- | ---------------------------- |
| SEO research, {site}   | `jabraf-seo-research`   | Mon 07:13                    |
| SEO writer, {site}     | `jabraf-seo-writer`     | Tue 07:17 (add Thu for more) |
| SEO QA, {site}         | `jabraf-seo-qa`         | Tue 13:17, Wed 13:17         |
| SEO publish, {site}    | `jabraf-seo-publish`    | daily 18:07                  |
| SEO audit, {site}      | `jabraf-seo-audit`      | Fri 07:23                    |
| SEO conversion, {site} | `jabraf-seo-conversion` | 1st of the month 07:29       |

Stagger minutes across sites so they do not all start at once. Confirm times and the connector
grant with the user before creating tasks.

- **Usual start:** research, writer, QA and publish. Add audit once pages have 4 or more weeks of
  data, and conversion once `goal.attribution.first_touch_recorded` is true.
- **Refresh-only start:** set `new_pages_per_week: 0` (in the base cadence or a `cadence.ramp`
  entry) and create audit, writer, QA and publish. Research may be scheduled too; it exits without
  spending credits until the ramp raises new pages above 0.
- **Upgrading the loop:** a new tag (`seo-loop-v2`) changes nothing until each task's prompt and
  the CI `SKILLS_SHA` are moved to it. Compare the new `seo.config.example.yaml` with the repo's
  config for new keys first.

Weekly human time: 30 to 60 minutes reviewing the PRs QA could not merge, plus a skim of the audit
summary.

## Migrating a repo that has the old kit copies

For repos set up from the Automated SEO Kit (`.claude/skills/seo-*` in the repo):

1. **Config keys.** Keep `seo.config.yaml` and move renamed keys:
   - `auto_merge.promote_production`, `promote_workflow`, `staging_wait_minutes` move under
     `auto_merge.promote` as `enabled`, `workflow`, `staging_wait_minutes`. Add `staging_ready`
     (the condition the old Promote step checked, such as the release-candidate tag) and
     `live_version_selector` (such as `meta[name="version"]`).
   - Copy rules held in prose (such as compliance wording in `voice.brand_name_rule`) into
     `voice.rules` or `facts.forbidden_claims`.
   - Add `publish.deploy_wait_minutes`, and `seo_lint.pages` when CI linted changed pages with
     repo-specific mapping code (such as an allowlist of published files).
2. **Remove the copies:** `.claude/skills/seo-*`, `scripts/seo-lint.mjs`,
   `scripts/seo-lint-changed.mjs` and its test, `.github/ISSUE_TEMPLATE/seo-*.md` and
   `.github/seo-labels.json`. Labels already on GitHub stay. Remove any test or allowlist entry
   that only existed for the old scripts.
3. **CI:** replace a step that ran the local scripts with the CI lint step above.
4. **AGENTS.md:** replace any kit section with the pointer block above.
5. **Scheduled tasks:** update each prompt to the template above, keeping its schedule.
6. **Check:** run the CI lint step's command locally against a branch with one changed page, and
   confirm open `seo:*` issues and PRs need no change (labels are the same).
