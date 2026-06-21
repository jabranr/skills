---
name: jabraf-workflows-integration
description: Wire the `reusable-integration` Playwright reusable workflow from `jabranr/workflows` into a downstream repo as a caller workflow with one job per detected test-type (job-level `uses:`). Load when the user asks to add Playwright tests to CI, set up e2e/smoke/functional/vr tests on PRs, or wire `jabranr/workflows` integration tests. Do not load for adding a step into an existing workflow (that's an action skill).
---

# `jabraf-workflows-integration`

Wires the
[`reusable-integration`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-integration.yml)
Playwright reusable workflow from
[`jabranr/workflows`](https://github.com/jabranr/workflows) into the current
repo as a caller workflow at `.github/workflows/integration.yml`, emitting one
job per detected `test:<type>` script. Prose-only — you (the agent) read the
file system, run the commands, and confirm with the user before any
irreversible step.

The canonical input reference and supported test-types live in
[`jabranr/workflows` README → `reusable-integration.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-integrationyml).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "Playwright in CI", "e2e tests in CI", "smoke tests in CI"
- "visual regression CI", "integration tests on PR"
- "`jabranr/workflows` integration", "jabraf integration tests"

Do not load for adding a step into an existing workflow (use an action skill
instead). Do not load for unit-test runners on PRs (that is `jabraf-workflows-pr-checks`).

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll wire `reusable-integration` from `jabranr/workflows` as `.github/workflows/integration.yml`, emitting one job per detected `test:<type>` script. That's: detect existing CI, detect test-types from `package.json`, confirm with you, write the caller. Proceed?" **[wait for user]**

2. **Detect existing CI.** Grep `.github/workflows/*.{yml,yaml}` for an existing caller of the same reusable workflow:

   ```bash
   grep -l 'jabranr/workflows/.github/workflows/reusable-integration.yml' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file and ask: "An existing caller of `reusable-integration` was found at `<path>`. Replace it, rename the new caller, or abort?" **[wait for user]** Never overwrite silently.

3. **Detect consumer context.** Read `package.json` once and probe:

   | Input                    | Signal                                                                                             | Behaviour                                                                                                                                                   |
   | ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `node-version`           | `.nvmrc`, `volta.node`, or `engines.node`                                                          | Fall back to `24` if absent                                                                                                                                 |
   | detected test-types      | `scripts["test:functional"]`, `scripts["test:e2e"]`, `scripts["test:smoke"]`, `scripts["test:vr"]` | **Emit one job per detected script.** If none, stop (see edge cases).                                                                                       |
   | `container-image`        | Presence of `Dockerfile`, `.devcontainer/`, or repo docs naming an image                           | Never guess; ask the user whether to run in a container and which image. Default empty (bare runner).                                                       |
   | `run-setup-node`         | Derived from the `container-image` answer                                                          | Default `false` whenever the user picks any image; otherwise leave default (`true`).                                                                        |
   | `run-playwright-install` | Derived from the `container-image` answer                                                          | If the image name suggests Playwright (e.g. starts with `mcr.microsoft.com/playwright`), propose `false`; otherwise leave default (`true`). Always confirm. |
   | `timeout-minutes`        | (not detectable)                                                                                   | Accept default `60`                                                                                                                                         |
   | `reports-retention-days` | (not detectable)                                                                                   | Accept default `7`                                                                                                                                          |

   If none of the four `test:<type>` scripts exist, stop and tell the user: "No Playwright test scripts (`test:functional`, `test:e2e`, `test:smoke`, `test:vr`) were found in `package.json`. Add at least one before wiring this workflow." **[wait for user]**

4. **Single consolidated confirmation.** Present the detected `node-version`, the list of detected test-types as the jobs that will be emitted, the chosen `container-image` (or "none"), and the resulting `run-setup-node` and `run-playwright-install` values. Confirm or override. **[wait for user]**

5. **Write the caller YAML.** Default path: `.github/workflows/integration.yml`. If the path is occupied (and is not the existing caller surfaced in step 2), ask **replace / rename / abort**. **[wait for user if conflict]** Write the file with this body — **emit only the jobs for detected scripts**:

   ```yaml
   name: Integration tests

   on:
     pull_request:
     workflow_dispatch:

   permissions:
     contents: read

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     functional:
       uses: jabranr/workflows/.github/workflows/reusable-integration.yml@main
       with:
         node-version: <detected>
         test-type: functional
         # Container options (omit for bare runner):
         # container-image: mcr.microsoft.com/playwright:v1.55.0-noble
         # run-setup-node: false
         # run-playwright-install: false
     e2e:
       uses: jabranr/workflows/.github/workflows/reusable-integration.yml@main
       with:
         node-version: <detected>
         test-type: e2e
         # Container options (omit for bare runner):
         # container-image: mcr.microsoft.com/playwright:v1.55.0-noble
         # run-setup-node: false
         # run-playwright-install: false
     smoke:
       uses: jabranr/workflows/.github/workflows/reusable-integration.yml@main
       with:
         node-version: <detected>
         test-type: smoke
         # Container options (omit for bare runner):
         # container-image: mcr.microsoft.com/playwright:v1.55.0-noble
         # run-setup-node: false
         # run-playwright-install: false
     vr:
       uses: jabranr/workflows/.github/workflows/reusable-integration.yml@main
       with:
         node-version: <detected>
         test-type: vr
         # Container options (omit for bare runner):
         # container-image: mcr.microsoft.com/playwright:v1.55.0-noble
         # run-setup-node: false
         # run-playwright-install: false
     # Only emit the jobs whose `test:<type>` script exists.
   ```

6. **Print required secrets.** None — state: "No secrets required for this caller."

7. **Validate.** Recommend running `actionlint` against the new file. If `jabraf-workflows-actionlint` is already wired in another workflow, validation runs on the next PR. Otherwise, offer to wire it next.

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA:

```yaml
uses: jabranr/workflows/.github/workflows/reusable-integration.yml@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not emit jobs for test-types whose `test:<type>` script does not exist in `package.json`.
- Do not invent new `test-type` values — the source workflow validates against `functional`, `e2e`, `smoke`, `vr` and fails fast otherwise.
- Do not overwrite an existing `.github/workflows/integration.yml` without explicit confirmation.
- Do not install Playwright on the user's behalf — the reusable workflow assumes the consumer's `test:<type>` script calls Playwright.
- Do not commit, push, or open PRs at any step.
- Do not set `run-setup-node: false` or `run-playwright-install: false` without also setting `container-image`. Both steps must run on a bare runner.
- Do not infer `container-image` from filename heuristics. Always confirm the image string with the user.
- Do not document image-name auto-detection. The workflow does not do this.

## Edge cases

| Situation                                                        | Action                                                                                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `test:<type>` scripts present                                 | Stop. Per step 3, ask the user to add at least one before wiring.                                                                                    |
| `@playwright/test` not in `dependencies` / `devDependencies`     | Surface this — the reusable workflow installs Playwright browsers, but the test runner itself must be a consumer dep. Recommend `jabraf-playwright`. |
| User wants a test-type that does not have a `test:<type>` script | Ask them to add the script first; do not emit the job speculatively.                                                                                 |
| Existing caller present                                          | Per step 2: ask replace / rename / abort. Never silently overlay.                                                                                    |
| User asks to gate jobs on a Cloudflare Pages deployment          | Recommend `jabraf-workflows-wait-cf-pages` and wire a `deployment-status` job that the integration jobs `needs:` on.                                 |
| `engines.node` specifies a range                                 | Use the lower bound's major version. Surface the choice.                                                                                             |

## Reference

- Source workflow: [`.github/workflows/reusable-integration.yml`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-integration.yml)
- README section: [`reusable-integration.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-integrationyml)
- Companion skills: `jabraf-workflows-pr-checks` (unit/lint/typecheck on PR), `jabraf-workflows-wait-cf-pages` (gate on Pages deploy), `jabraf-workflows-actionlint` (lint this file), `jabraf-playwright` (set up Playwright in the project)
