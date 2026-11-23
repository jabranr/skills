---
name: jabraf-seo-audit
description: Weekly performance and technical audit of existing pages in Jabran's SEO loop. Opens seo:refresh issues (up to the effective weekly refresh cadence) and seo:technical issues, and posts a weekly summary. Works without research, so a refresh-only start runs on it. Load when asked to audit SEO performance on a repo with seo.config.yaml, or by its weekly audit scheduled task.
---

# `jabraf-seo-audit`

Output: up to the effective `refreshes_per_week` `seo:refresh` issues, any `seo:technical`
issues, and a weekly summary comment on the tracking issue `SEO loop — tracking`. Load
`jabraf-seo-brief` the way this skill was loaded (the same `npx -y skills@1.5.12 use` URL and ref,
skill name swapped) when you need it.

**Effective cadence:** the `cadence.ramp` entry with the latest `from` on or before today
overrides `cadence.refreshes_per_week` and `openseo.weekly_credit_budget`; a key it leaves out
keeps the base value.

## Data (free first)

- `get_search_console_performance`: `['page']` for the last 28 days against the previous 28
  (explicit dates); `['query','page']` for last_3_months; `['date']` for the trend.
- `get_rank_tracker`, and `run_rank_tracker` when it is due and within budget.
- `inspect_urls` for pages published 7 or more days ago with 0 impressions, and for money pages.
- Monthly, or when budget allows: `run_site_audit`, then `get_audit_issues`.
- Conversions per page when `goal.attribution.first_touch_recorded` is true, from
  `goal.attribution.how_to_query` (read-only).

## Diagnose, then act

| Signal                                                         | Issue                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| High impressions, CTR below expected for its position          | `seo:refresh`: rewrite title and meta description (one change)        |
| Average position 8 to 20 with real impressions                 | `seo:refresh`: expand with missing subtopics or PAA, better answer    |
| Clicks down more than 30% against the previous period          | `seo:refresh`: compare the SERP now and then; update facts, freshness |
| Ranks but converts poorly for its type                         | `seo:refresh`: CTA, intent match, link to a money page                |
| Two URLs ranking for the same query                            | `seo:refresh`: merge and redirect, or differentiate                   |
| Not indexed after 14 days, or "crawled, not indexed"           | `seo:technical`, or `seo:refresh` when thin or duplicate (say which)  |
| URL variants (slash, `#`, `?`) or app or auth pages in results | `seo:technical`: canonicals, redirects, `noindex`                     |
| Site-audit errors (broken links, missing meta, slow pages)     | `seo:technical`                                                       |

Favour refreshes on pages that already show demand. Leave pages changed in the last 21 days alone
so Google can re-crawl them. Each refresh issue gets its body from `jabraf-seo-brief` in refresh
mode. Skip duplicates of open issues. Done when the effective `refreshes_per_week` issues are open
or no further page qualifies.

## Summary comment

Week-over-week clicks, impressions and CTR; top movers up and down; new pages' index status; issues
opened; credits used against the effective budget; and one sentence on what to try next.
