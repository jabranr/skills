---
name: jabraf-workflows-wait-cf-pages
description: Insert the `wait-cf-pages-deployment` composite action from `jabranr/workflows` as a step that blocks until the Cloudflare Pages check run completes (step-level `uses:`). Load when the user asks to wait for a Cloudflare Pages deployment, gate a Lighthouse/audit job on a successful Pages build, or wire `jabranr/workflows` wait-cf-pages. Do not load for creating a new top-level workflow file.
---

# `jabraf-workflows-wait-cf-pages`

Inserts the
[`wait-cf-pages-deployment`](https://github.com/jabranr/workflows/tree/main/.github/actions/wait-cf-pages-deployment)
composite action from
[`jabranr/workflows`](https://github.com/jabranr/workflows) as a step that
polls the GitHub Checks API until the Cloudflare Pages check run for the
current ref reaches a completed state. Use this to gate a downstream job
(e.g. a Lighthouse audit) on a successful Pages deploy. Prose-only — you
(the agent) read the file system, surface candidates, and confirm with the
user before any irreversible step.

The canonical placement and behaviour reference lives in
[`jabranr/workflows` README → `actions/wait-cf-pages-deployment`](https://github.com/jabranr/workflows/blob/main/README.md#actionswait-cf-pages-deployment).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "wait for Cloudflare Pages", "block on Pages deployment"
- "Pages check run", "gate Lighthouse on deployment"
- "`jabranr/workflows` wait-cf-pages", "jabraf wait Pages"

Do not load for creating a new top-level workflow file (use a workflow skill).
Do not load for waiting on non-Cloudflare deployments (Vercel, Netlify) —
this action only resolves the Cloudflare Pages check run.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll insert the `wait-cf-pages-deployment` composite action. That's: detect existing workflows that have a deployment trigger or a downstream audit job, surface candidates, write the snippet inline. The enclosing job must declare `permissions: checks: read` — I'll surface that explicitly. Proceed?" **[wait for user]**

2. **Detect candidate workflows.** Scan `.github/workflows/*.{yml,yaml}` for workflows that either trigger on `pull_request` / `push` (Cloudflare Pages posts its check against the head commit on these events) or contain a downstream audit job (`performance-audit`, `lighthouse`, `audit`):

   ```bash
   grep -lE 'pull_request|push|performance-audit|lighthouse|audit' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If none exist, ask: "No existing workflows look like deployment-aware candidates. Should I recommend creating a new `deployment-status` job inside `pr-checks.yml`, or is there a specific workflow file you'd like to target?" **[wait for user]**

3. **Detect existing usage.** Grep the candidates for an existing reference:

   ```bash
   grep -l 'jabranr/workflows/.github/actions/wait-cf-pages-deployment' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file(s) and stop: "`wait-cf-pages-deployment` is already wired in `<path>`. No changes needed." **[wait for user]** Never insert a duplicate.

4. **Pick a target.** Present the candidate workflows and ask whether to insert the step into an existing job or to create a dedicated `deployment-status` job that downstream jobs `needs:` on. Recommend the dedicated-job pattern — it makes the gate reusable and keeps `checks: read` scoped. **[wait for user]**

5. **Show the diff, do not auto-edit.** Print the snippet and the exact placement instruction. Ask: "Apply this change automatically (with a diff preview), or paste it in yourself?" **[wait for user]**

   The dedicated-job snippet:

   ```yaml
   deployment-status:
     runs-on: ubuntu-latest
     permissions:
       checks: read
     steps:
       - name: Wait for Cloudflare Pages deployment
         uses: jabranr/workflows/.github/actions/wait-cf-pages-deployment@main
         with:
           max-attempts: 9 # optional, default: 9
           interval-seconds: 15 # optional, default: 15
   ```

   For downstream jobs that should gate on the deployment, add `needs: [deployment-status]`.

6. **Print required secrets and permissions.** State explicitly:
   - **No repo secrets required.** The action defaults `github-token` to `github.token`.
   - **`permissions: checks: read` is mandatory on the enclosing job.** Without it the action throws `Resource not accessible by integration` (verbatim from the source README).

7. **Validate.** Recommend the user opens a PR against a Cloudflare-Pages-connected repo and confirms the step polls and resolves. If no Cloudflare Pages check is found for the ref, the action emits a `core.warning` and exits successfully — this is expected, not an error.

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA:

```yaml
uses: jabranr/workflows/.github/actions/wait-cf-pages-deployment@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not omit `permissions: checks: read` on the enclosing job. This is non-default and the most common failure mode.
- Do not silently edit a workflow file. Always show the diff and confirm.
- Do not raise `max-attempts` past the source default without surfacing the trade-off (15s × 9 = ~2 minutes; longer waits hold a runner).
- Do not assume the action will fail loudly if no Pages check is posted — it warns and exits 0 by design. Set user expectations.
- Do not commit, push, or open PRs at any step.

## Edge cases

| Situation                                                       | Action                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo is not connected to Cloudflare Pages                       | The action will emit `core.warning: no check found` and exit 0. Surface this so the user knows the gate is a no-op until Pages is wired up.                   |
| Workflow triggers only on `workflow_dispatch`                   | Cloudflare Pages does not post a check on dispatch events. Surface and recommend adding a `pull_request` or `push` trigger.                                   |
| Enclosing job already declares `permissions:` for other actions | Merge `checks: read` into the existing block — do not overwrite. Show the diff.                                                                               |
| User wants to wait for a non-Pages deployment                   | Out of scope. The action specifically resolves the Cloudflare Pages check run.                                                                                |
| User wants to skip the gate on draft PRs                        | Wrap the job in `if: ${{ !github.event.pull_request.draft }}`. Surface as a suggestion; do not add unprompted.                                                |
| Downstream audit job is in a separate workflow file             | Cross-workflow `needs:` is not supported. Either move the audit job into the same workflow, or use a `workflow_run` trigger — recommend the same-file option. |

## Reference

- Source action: [`.github/actions/wait-cf-pages-deployment`](https://github.com/jabranr/workflows/tree/main/.github/actions/wait-cf-pages-deployment)
- README section: [`actions/wait-cf-pages-deployment`](https://github.com/jabranr/workflows/blob/main/README.md#actionswait-cf-pages-deployment)
- Companion skills: `jabraf-workflows-performance-audit` (Lighthouse job to gate behind the wait), `jabraf-workflows-actionlint` (lint the modified workflow)
