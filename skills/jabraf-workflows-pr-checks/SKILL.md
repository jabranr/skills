---
name: jabraf-workflows-pr-checks
description: Wire the `reusable-pr-checks` reusable workflow from `jabranr/workflows` into a downstream JS/Node repo as a caller workflow file (job-level `uses:`). Load when the user asks to add PR checks, set up CI for pull requests, run tests/lint/format/typecheck on PRs, or wire `jabranr/workflows` PR checks. Do not load for adding a step into an existing workflow (that's an action skill).
---

# `jabraf-workflows-pr-checks`

Wires the
[`reusable-pr-checks`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-pr-checks.yml)
reusable workflow from
[`jabranr/workflows`](https://github.com/jabranr/workflows) into the current
repo as a caller workflow at `.github/workflows/pr-checks.yml`. Prose-only —
you (the agent) read the file system, run the commands, and confirm with the
user before any irreversible step.

The canonical input/secret reference lives in
[`jabranr/workflows` README → `reusable-pr-checks.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-pr-checksyml).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "add PR checks", "set up CI", "CI for pull requests"
- "run tests on PRs", "lint/format/typecheck on PRs"
- "`jabranr/workflows` PR checks", "jabraf PR checks", "pre-release on PR"

Do not load for adding a step into an existing workflow file (use
`jabraf-workflows-actionlint`, `jabraf-workflows-wait-cf-pages`, or
`jabraf-workflows-performance-audit` instead). Do not load for unrelated CI
tooling (CircleCI, Travis, Jenkins).

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll wire `reusable-pr-checks` from `jabranr/workflows` as `.github/workflows/pr-checks.yml`. That's: detect existing CI, detect inputs from `package.json`, confirm with you (including `run-pre-release` / `NPM_TOKEN`), write the caller, then list the required secrets. Proceed?" **[wait for user]**

2. **Detect existing CI.** Grep `.github/workflows/*.{yml,yaml}` for an existing caller of the same reusable workflow:

   ```bash
   grep -l 'jabranr/workflows/.github/workflows/reusable-pr-checks.yml' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file and ask: "An existing caller of `reusable-pr-checks` was found at `<path>`. Replace it, rename the new caller, or abort?" **[wait for user]** Never overwrite silently.

3. **Detect consumer context.** Read `package.json` once and probe for these signals — surface the detected values in a single table:

   | Input              | Signal                                                                      | Default if absent |
   | ------------------ | --------------------------------------------------------------------------- | ----------------- |
   | `use-lerna`        | `lerna.json` present, or `workspaces` field, or a `packages/` directory     | `false`           |
   | `run-unit-test`    | `scripts.test` exists                                                       | `false`           |
   | `run-build`        | `scripts.build` exists                                                      | `false`           |
   | `run-lint`         | `scripts.lint` exists                                                       | `false`           |
   | `run-format-check` | `scripts["format:check"]` exists                                            | `false`           |
   | `run-typecheck`    | `scripts.typecheck` exists                                                  | `false`           |
   | `node-version`     | `.nvmrc`, `volta.node` in `package.json`, or `engines.node` (major version) | `24`              |

4. **Single consolidated confirmation.** Present the detected values as a table and ask the user to confirm or override each. Then ask explicitly: "Should the pre-release publish jobs run on PRs that contain `[publish]` in the latest commit? This requires `NPM_TOKEN` to be set as a repo secret." Capture `run-pre-release` (true/false) and, if true, `pre-release-tag` (default `rc`). **[wait for user]**

5. **Write the caller YAML.** Default path: `.github/workflows/pr-checks.yml`. If the path is occupied (and is not the existing caller surfaced in step 2), ask **replace / rename / abort**. **[wait for user if conflict]** Write the file with this exact body, substituting the confirmed values:

   ```yaml
   name: PR checks

   on:
     pull_request:

   permissions:
     contents: read

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     pr-checks:
       uses: jabranr/workflows/.github/workflows/reusable-pr-checks.yml@main
       with:
         node-version: <detected>
         use-lerna: <detected>
         run-unit-test: <detected>
         run-build: <detected>
         run-lint: <detected>
         run-format-check: <detected>
         run-typecheck: <detected>
         run-pre-release: <user-confirmed>
         pre-release-tag: rc # only emit when run-pre-release: true
       secrets:
         npm-token: ${{ secrets.NPM_TOKEN }} # only emit when run-pre-release: true
   ```

   Omit the `secrets:` block and the `pre-release-tag` line entirely when `run-pre-release: false`.

6. **Print required secrets.** Tell the user, verbatim:
   - `NPM_TOKEN` — required **only** if `run-pre-release: true`. Add via repo Settings → Secrets and variables → Actions → New repository secret.

   If `run-pre-release: false`, state: "No secrets required for this caller."

7. **Validate.** Recommend running `actionlint` against the new file. If the repo already has a workflow that uses the `jabraf-workflows-actionlint` composite, this is automatic on the next PR. Otherwise, offer to wire `jabraf-workflows-actionlint` next.

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA (recommended for production repos once `jabranr/workflows`
stabilises):

```yaml
uses: jabranr/workflows/.github/workflows/reusable-pr-checks.yml@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not overwrite an existing `.github/workflows/pr-checks.yml` without explicit confirmation.
- Do not emit `secrets.npm-token` when `run-pre-release: false` — it triggers a validation failure in the reusable workflow.
- Do not modify any other workflow files in `.github/workflows/`.
- Do not commit, push, or open PRs at any step.
- Do not add `pre-release-tag` when `run-pre-release: false`.

## Edge cases

| Situation                                                  | Action                                                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                              | Stop. Ask the user to initialise the project first.                                                                                            |
| `.github/workflows/` directory does not exist              | Create it as part of step 5.                                                                                                                   |
| Existing caller uses a different ref (e.g. a pinned SHA)   | Surface the diff and let the user choose whether to keep their pin or move to `@main`.                                                         |
| Monorepo (`workspaces` present) without `lerna.json`       | Default `use-lerna: false`; surface the ambiguity and let the user confirm.                                                                    |
| `engines.node` specifies a range (e.g. `>=20`)             | Use the lower bound's major version. Surface the choice.                                                                                       |
| User asks to also publish on PR but has no `NPM_TOKEN` set | Set `run-pre-release: true` in the caller and explicitly remind the user that the `check-publish` job will fail fast until `NPM_TOKEN` is set. |

## Reference

- Source workflow: [`.github/workflows/reusable-pr-checks.yml`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-pr-checks.yml)
- README section: [`reusable-pr-checks.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-pr-checksyml)
- Companion skills: `jabraf-workflows-npm-publish` (release on merge), `jabraf-workflows-integration` (Playwright in CI), `jabraf-workflows-actionlint` (lint this file)
