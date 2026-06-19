---
name: jabraf-workflows-actionlint
description: Insert the `actionlint` composite action from `jabranr/workflows` as a step inside an existing workflow job to lint all `.github/workflows/*.yml` files (step-level `uses:`). Load when the user asks to lint GitHub Actions YAML, add `actionlint`, set up workflow validation, or wire `jabranr/workflows` actionlint. Do not load for creating a new top-level workflow file (that's a workflow skill).
---

# `jabraf-workflows-actionlint`

Inserts the
[`actionlint`](https://github.com/jabranr/workflows/tree/main/.github/actions/actionlint)
composite action from
[`jabranr/workflows`](https://github.com/jabranr/workflows) as a step inside
an existing workflow job. The action downloads the official `actionlint`
installer and runs it against every `.github/workflows/*.yml` file in the
repo. Prose-only — you (the agent) read the file system, surface candidates,
and confirm with the user before any irreversible step.

The canonical placement guidance lives in
[`jabranr/workflows` README → `actions/actionlint`](https://github.com/jabranr/workflows/blob/main/README.md#actionsactionlint).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "lint workflows", "lint GitHub Actions YAML"
- "actionlint", "validate GitHub Actions YAML"
- "`jabranr/workflows` actionlint", "jabraf actionlint"

Do not load for creating a new top-level workflow file (use
`jabraf-workflows-pr-checks`, `jabraf-workflows-npm-publish`, or
`jabraf-workflows-integration` instead). Do not load for unrelated YAML
linters (yamllint, prettier on YAML).

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll insert the `actionlint` composite action from `jabranr/workflows` as a step in an existing job. That's: scan existing workflows for jobs with a `checkout` step, surface candidates, write the snippet inline. Proceed?" **[wait for user]**

2. **Detect candidate workflows.** Scan `.github/workflows/*.{yml,yaml}` for jobs that include an `actions/checkout` step:

   ```bash
   grep -l 'actions/checkout@' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If none exist, stop and recommend: "No existing workflows with a `checkout` step were found. Wire `jabraf-workflows-pr-checks` first — that creates a workflow which then becomes a target for this skill." **[wait for user]**

3. **Detect existing actionlint usage.** Grep the candidates for an existing reference to the action:

   ```bash
   grep -l 'jabranr/workflows/.github/actions/actionlint' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file(s) and stop: "`actionlint` is already wired in `<path>`. No changes needed." **[wait for user]** Never insert a duplicate.

4. **Pick a target.** Present the candidate workflows and the jobs within each that have a `checkout` step. Ask: "Which job should the `actionlint` step be inserted into?" **[wait for user]**

5. **Show the diff, do not auto-edit.** YAML step insertion is structurally fragile (indentation, anchors, multi-line strings). Print the snippet and the exact placement instruction — let the user apply the edit themselves, or ask explicitly: "Would you like me to attempt the insertion automatically? I will read the chosen file, locate the `actions/checkout` line, and insert the new step on the next line at matching indentation. Show me a diff before writing?" **[wait for user]**

   The snippet:

   ```yaml
   steps:
     - uses: actions/checkout@v4
     - uses: jabranr/workflows/.github/actions/actionlint@main
   ```

   Placement rule: immediately after the `actions/checkout` step, at the same indentation.

6. **Print required secrets.** None — state: "No secrets required. The action does not call the GitHub API."

7. **Validate.** Recommend the user opens a PR and confirms the new step runs and reports green. Locally, the user can also run `actionlint` directly against the workflow file:

   ```bash
   actionlint .github/workflows/<file>.yml
   ```

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA:

```yaml
uses: jabranr/workflows/.github/actions/actionlint@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not silently edit a workflow file. Always show the diff and confirm.
- Do not insert the step before `actions/checkout` — the action needs the repo's workflow files on disk.
- Do not insert the step into a job that has no `actions/checkout` — it will lint zero files and emit no output, which is confusing.
- Do not add a job-level `permissions:` block — the action does not call the API.
- Do not commit, push, or open PRs at any step.

## Edge cases

| Situation                                                   | Action                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| No workflow files in `.github/workflows/`                   | Stop. Per step 2, recommend wiring `jabraf-workflows-pr-checks` first.                                                                             |
| `actionlint` already wired in some workflow                 | Per step 3, stop and report. Do not duplicate.                                                                                                     |
| Workflow uses a matrix `checkout` (`with: { ref: ... }`)    | Same placement — immediately after the matrix `checkout` step. The action lints workflow files at the checked-out ref.                             |
| Target job is itself a `uses:` (reusable workflow caller)   | Stop. Reusable-workflow callers have no `steps:` block to insert into. Recommend a separate `lint` job or insertion in the called workflow's repo. |
| User wants `actionlint` as its own dedicated workflow       | Out of scope for this skill — it is composite-action only. Recommend wrapping the snippet in a tiny `actionlint.yml` workflow on their own.        |
| Workflow runs on a non-Linux runner (e.g. `windows-latest`) | The action uses `curl -fsSL` and a bash installer; surface this and recommend keeping the step on a `ubuntu-latest` job.                           |

## Reference

- Source action: [`.github/actions/actionlint`](https://github.com/jabranr/workflows/tree/main/.github/actions/actionlint)
- README section: [`actions/actionlint`](https://github.com/jabranr/workflows/blob/main/README.md#actionsactionlint)
- Upstream tool: [`actionlint`](https://github.com/rhysd/actionlint)
- Companion skills: `jabraf-workflows-pr-checks`, `jabraf-workflows-npm-publish`, `jabraf-workflows-integration` (all good insertion targets)
