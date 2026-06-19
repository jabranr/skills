---
name: jabraf-workflows-performance-audit
description: Insert the `performance-audit` composite action from `jabranr/workflows` as a step that runs Lighthouse against one or more URLs and posts results to PRs or uploads them as artifacts (step-level `uses:`). Load when the user asks to add Lighthouse to CI, run performance audits, audit Core Web Vitals on PRs, or wire `jabranr/workflows` performance-audit. Do not load for creating a new top-level workflow file.
---

# `jabraf-workflows-performance-audit`

Inserts the
[`performance-audit`](https://github.com/jabranr/workflows/tree/main/.github/actions/performance-audit)
composite action from
[`jabranr/workflows`](https://github.com/jabranr/workflows) as a step that
runs Lighthouse against one or more URLs. On `pull_request` events the action
posts results as a PR comment; on `push` events the HTML reports are uploaded
as a `lighthouse-results` workflow artifact. Prose-only — you (the agent)
read the file system, surface candidates, and confirm with the user before
any irreversible step.

The canonical placement and behaviour reference lives in
[`jabranr/workflows` README → `actions/performance-audit`](https://github.com/jabranr/workflows/blob/main/README.md#actionsperformance-audit).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "Lighthouse in CI", "performance audit on PR"
- "Core Web Vitals CI", "Lighthouse PR comment"
- "`jabranr/workflows` performance audit", "jabraf performance audit"

Do not load for creating a new top-level workflow file (use a workflow skill).
Do not load for non-Lighthouse perf tooling (WebPageTest, SpeedCurve, Calibre)
unless the user also asks for `jabranr/workflows`.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll insert the `performance-audit` composite action. That's: ask for the URL list, detect existing workflows, surface candidates, write the snippet inline. The enclosing job must declare `permissions: pull-requests: write` and `contents: read` — I'll surface that explicitly. Proceed?" **[wait for user]**

2. **Ask for the URL list.** This input is not detectable. Ask: "Which URLs should Lighthouse audit? Comma-separated, e.g. `https://example.com,https://example.com/about`." If `package.json` has a `homepage` field, suggest it as a default. **[wait for user]**

3. **Detect candidate workflows.** Scan `.github/workflows/*.{yml,yaml}` for workflows that look like good insertion targets — ones with a deployment trigger or an existing `deployment-status` / `audit` job:

   ```bash
   grep -lE 'pull_request|push|deployment-status|audit' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If none exist, ask: "No existing workflows look like good targets. Should I recommend creating a new `audit` job inside `pr-checks.yml`, or is there a specific workflow file you'd like to target?" **[wait for user]**

4. **Detect existing usage.** Grep the candidates for an existing reference:

   ```bash
   grep -l 'jabranr/workflows/.github/actions/performance-audit' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file(s) and stop: "`performance-audit` is already wired in `<path>`. No changes needed." **[wait for user]** Never insert a duplicate.

5. **Pick a target.** Present the candidate workflows. If a `deployment-status` job exists (likely from `jabraf-workflows-wait-cf-pages`), recommend the dedicated `audit` job pattern with `needs: [deployment-status]` so Lighthouse only runs after the Pages deploy is live. **[wait for user]**

6. **Show the diff, do not auto-edit.** Print the snippet and the exact placement instruction. Ask: "Apply this change automatically (with a diff preview), or paste it in yourself?" **[wait for user]**

   The dedicated-job snippet (preferred when paired with `jabraf-workflows-wait-cf-pages`):

   ```yaml
   audit:
     runs-on: ubuntu-latest
     needs: [deployment-status] # optional — only if a deployment-status job exists
     permissions:
       pull-requests: write
       contents: read
     steps:
       - uses: jabranr/workflows/.github/actions/performance-audit@main
         with:
           urls: '<comma-separated URLs from step 2>'
           github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

   If no `deployment-status` job exists, drop the `needs:` line.

7. **Print required secrets and permissions.** State explicitly:
   - **`GITHUB_TOKEN`** — auto-bound by GitHub Actions; no manual setup. Used to post the PR comment / commit status.
   - **`permissions: pull-requests: write`** — mandatory on the enclosing job for the PR comment to land.
   - **`permissions: contents: read`** — required to clone the repo if `actions/checkout` is also present in the job.

8. **Validate.** Recommend the user opens a PR and confirms a Lighthouse comment appears. For `push` events, confirm the `lighthouse-results` artifact lands in the workflow run summary.

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA:

```yaml
uses: jabranr/workflows/.github/actions/performance-audit@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not invent URLs. The `urls` input must come from the user (or `package.json` `homepage` with explicit confirmation).
- Do not omit `permissions: pull-requests: write` — the PR comment fails silently without it.
- Do not run the audit against `localhost` or pre-deploy URLs — Lighthouse needs a publicly reachable origin.
- Do not silently edit a workflow file. Always show the diff and confirm.
- Do not pair the action with a `pull_request_target` trigger unless the user understands the security model — `pull-requests: write` on a fork PR is a privilege boundary.
- Do not commit, push, or open PRs at any step.

## Edge cases

| Situation                                                       | Action                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URLs include preview / per-PR subdomains                        | Recommend pairing with `jabraf-workflows-wait-cf-pages` so the audit waits for the preview to be live, and templating the URL via `${{ steps.<x>.outputs }}`. |
| User wants per-page budgets / asserts                           | Out of scope for this skill. The action returns the raw Lighthouse report; budgets must be enforced in a follow-up step.                                      |
| Repo blocks `actions[bot]` from commenting on PRs               | Surface this — the comment will silently 403. Recommend a PAT-backed `github-token` if the user cannot relax the restriction.                                 |
| User wants the artifact on `pull_request` events too            | Not configurable via inputs. Direct the user to the upstream README; do not patch the action.                                                                 |
| Enclosing job already declares `permissions:` for other actions | Merge `pull-requests: write` and `contents: read` into the existing block — do not overwrite. Show the diff.                                                  |
| URL list is very long (10+)                                     | Surface the runtime cost — each URL adds Lighthouse run time. Recommend splitting into multiple `audit` jobs or trimming the list.                            |

## Reference

- Source action: [`.github/actions/performance-audit`](https://github.com/jabranr/workflows/tree/main/.github/actions/performance-audit)
- README section: [`actions/performance-audit`](https://github.com/jabranr/workflows/blob/main/README.md#actionsperformance-audit)
- Companion skills: `jabraf-workflows-wait-cf-pages` (gate the audit on a live deploy), `jabraf-workflows-actionlint` (lint the modified workflow)
