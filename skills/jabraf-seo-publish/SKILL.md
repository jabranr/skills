---
name: jabraf-seo-publish
description: Closes out merged and deployed PRs in Jabran's SEO loop (merged by jabraf-seo-qa or a human). Verifies each changed URL is live, submits it for indexing, and labels its issue seo:published. Never merges or deploys. Load when asked to publish merged SEO pages on a repo with seo.config.yaml, by its daily publish scheduled task, or from jabraf-seo-qa after it merges.
---

# `jabraf-seo-publish`

1. **Find work.** PRs merged into `github.base_branch` since the last-run marker on the tracking
   issue `SEO loop — tracking`, whose issues are still labelled `seo:review` (or `seo:drafting`,
   when a human merged before QA). Called from `jabraf-seo-qa`: the PRs it hands over.
2. **Live check.** Fetch each changed URL from `site.base_url`. Live means HTTP 200, the expected
   canonical and title, present in the sitemap, and no `noindex`. Not live and the merge is newer
   than `publish.deploy_wait_minutes`: wait out the remainder once, then check again. Still not
   live: leave it for the next run, keeping its label.
3. **IndexNow.** `submit_indexnow_urls` with every live new or changed URL, plus the sitemap, in
   one batch.
4. **Inspect.** `inspect_urls` (10 at most) for the same URLs; record each coverage state. The
   audit re-checks after about 7 days.
5. **Rank tracker.** The page's target query missing from `openseo.rank_tracker_id`:
   `add_rank_tracking_keywords`, asking first when it would pass the weekly credit budget.
6. **Close out.** Label each issue `seo:published` (removing `seo:review` and `seo:drafting`),
   close it, and append one line per URL to the tracking issue: date, URL, target query,
   issue and PR. Update the last-run marker.

Done when every merged PR found in step 1 is either published or left with a stated reason.
