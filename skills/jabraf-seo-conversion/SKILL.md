---
name: jabraf-seo-conversion
description: Monthly conversion analysis for Jabran's SEO loop. Finds which landing pages and page types drive the north-star conversions, then updates the research weights in seo.config.yaml through a PR. Exits early with a short report while first-touch attribution is not recorded. Load when asked which SEO pages convert on a repo with seo.config.yaml, or by its monthly conversion scheduled task.
---

# `jabraf-seo-conversion`

Clicks are a leading signal; conversions are the goal. This skill closes the loop.

## 1. Can we measure?

`goal.attribution.first_touch_recorded` is false: post a short report on the tracking issue
`SEO loop — tracking` and stop. The report says the loop is blind, links the open `seo:technical`
attribution issue (or says none is open), and notes that research keeps the current weights.
No data pulls, no PR.

## 2. Pull data (last 90 days, organic only)

- Conversions by first landing path, from `goal.attribution.how_to_query` (DB query, admin API or
  analytics export). Reads only; production data stays untouched.
- Sessions or pageviews by landing path from the site's analytics.
- Clicks and impressions by page from `get_search_console_performance` `['page']`.
- When a GA4 property is bound in OpenSEO: `get_google_analytics_organic_landing_pages` and
  `get_google_analytics_key_events`.

## 3. Analyse

- Per page: organic clicks, conversions, conversion rate; north star and `goal.proxy_event`
  separately.
- Roll up by page type and by topic cluster (group slugs and queries by theme).
- Below about 10 conversions in a group, lean on the proxy event and say the signal is weak.

## 4. Update weights

New weight per type or cluster = clamp(0.5, 2.0, group conversion rate ÷ site organic conversion
rate), averaged 50/50 with the previous weight. Open a PR that changes only `weights` in
`seo.config.yaml`, with the table in the PR body. A human merges it.

## 5. Report

Comment on the tracking issue: the top 5 converting pages, the worst high-traffic, low-conversion
pages (open `seo:refresh` issues for them with a CTA and intent focus, skipping duplicates of
open issues), the weight changes, and progress against the north-star target in OpenSEO `current_goal`
(update it when the user agrees).
