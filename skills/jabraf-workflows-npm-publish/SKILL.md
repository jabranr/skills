---
name: jabraf-workflows-npm-publish
description: Wire the `reusable-npm-publish` reusable workflow from `jabranr/workflows` into a downstream JS/Node repo as a caller workflow file that publishes on push to `main` (job-level `uses:`). Load when the user asks to publish to npm on merge, set up automated releases, wire `jabranr/workflows` npm publish, or configure Lerna/conventional-commits versioning. Do not load for adding a step into an existing workflow (that's an action skill).
---

# `jabraf-workflows-npm-publish`

Wires the
[`reusable-npm-publish`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-npm-publish.yml)
reusable workflow from
[`jabranr/workflows`](https://github.com/jabranr/workflows) into the current
repo as a caller workflow at `.github/workflows/npm-publish.yml` that runs on
push to `main`. Prose-only — you (the agent) read the file system, run the
commands, and confirm with the user before any irreversible step.

The canonical input/secret reference lives in
[`jabranr/workflows` README → `reusable-npm-publish.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-npm-publishyml).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "publish to npm", "automated releases", "release workflow"
- "lerna publish", "conventional commits release"
- "`jabranr/workflows` npm publish", "jabraf npm publish"

Do not load for adding a step into an existing workflow file (use an action
skill instead). Do not load for unrelated release tooling (semantic-release,
release-please, changesets) unless the user also asks for `jabranr/workflows`.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll wire `reusable-npm-publish` from `jabranr/workflows` as `.github/workflows/npm-publish.yml`. That's: detect existing CI, detect inputs from `package.json`, confirm `NPM_TOKEN` is set, write the caller. Proceed?" **[wait for user]**

2. **Detect existing CI.** Grep `.github/workflows/*.{yml,yaml}` for an existing caller of the same reusable workflow:

   ```bash
   grep -l 'jabranr/workflows/.github/workflows/reusable-npm-publish.yml' .github/workflows/*.{yml,yaml} 2>/dev/null
   ```

   If a match is found, surface the file and ask: "An existing caller of `reusable-npm-publish` was found at `<path>`. Replace it, rename the new caller, or abort?" **[wait for user]** Never overwrite silently.

3. **Detect consumer context.** Read `package.json` once and probe the same signals as `jabraf-workflows-pr-checks` — surface as a single table:

   | Input              | Signal                                                                      | Default if absent |
   | ------------------ | --------------------------------------------------------------------------- | ----------------- |
   | `use-lerna`        | `lerna.json` present, or `workspaces` field, or a `packages/` directory     | `false`           |
   | `run-unit-test`    | `scripts.test` exists                                                       | `false`           |
   | `run-build`        | `scripts.build` exists                                                      | `false`           |
   | `run-lint`         | `scripts.lint` exists                                                       | `false`           |
   | `run-format-check` | `scripts["format:check"]` exists                                            | `false`           |
   | `run-typecheck`    | `scripts.typecheck` exists                                                  | `false`           |
   | `node-version`     | `.nvmrc`, `volta.node` in `package.json`, or `engines.node` (major version) | `24`              |

4. **Single consolidated confirmation.** Present the detected values as a table and ask the user to confirm or override each. Then ask explicitly: "Confirm that `NPM_TOKEN` is set as a repo secret with publish permission for this package. Without it, every publish run will fail." **[wait for user]**

5. **Write the caller YAML.** Default path: `.github/workflows/npm-publish.yml`. If the path is occupied (and is not the existing caller surfaced in step 2), ask **replace / rename / abort**. **[wait for user if conflict]** Write the file with this exact body, substituting the confirmed values:

   ```yaml
   name: Publish to npm

   on:
     push:
       branches: [main]

   permissions:
     contents: write # push version commit + tag
     id-token: write # future-proof for npm provenance

   # concurrency intentionally omitted — do not cancel mid-release

   jobs:
     publish:
       uses: jabranr/workflows/.github/workflows/reusable-npm-publish.yml@main
       with:
         node-version: <detected>
         use-lerna: <detected>
         run-unit-test: <detected>
         run-build: <detected>
         run-lint: <detected>
         run-format-check: <detected>
         run-typecheck: <detected>
       secrets:
         npm-token: ${{ secrets.NPM_TOKEN }}
         github-token: ${{ secrets.GITHUB_TOKEN }}
   ```

6. **Print required secrets.** Tell the user, verbatim:
   - `NPM_TOKEN` — required. An npm automation token with publish permission for this package. Add via repo Settings → Secrets and variables → Actions → New repository secret.
   - `GITHUB_TOKEN` — required. Bound automatically by GitHub Actions; no manual setup. The caller's `permissions: contents: write` block grants it the rights to push the version commit and tag.

7. **Validate.** Recommend running `actionlint` against the new file. If `jabraf-workflows-actionlint` is already wired in another workflow, validation runs on the next PR. Otherwise, offer to wire it next.

## Pinning

Default ref is `@main`, matching the source repo README. To pin to an
immutable SHA (recommended for production repos once `jabranr/workflows`
stabilises):

```yaml
uses: jabranr/workflows/.github/workflows/reusable-npm-publish.yml@<full-40-char-sha>
```

Replace `<full-40-char-sha>` with the commit SHA from
`https://github.com/jabranr/workflows/commits/main`.

## Things you must NOT do

- Do not overwrite an existing `.github/workflows/npm-publish.yml` without explicit confirmation.
- Do not add a `concurrency:` block — releases must not be cancelled mid-flight.
- Do not change the trigger to `pull_request` — this workflow only runs on push to `main`. Pre-release on PR is `jabraf-workflows-pr-checks`'s job.
- Do not omit `permissions: contents: write` — without it, the Lerna / npm version commit and tag push will fail.
- Do not commit, push, or open PRs at any step.

## Edge cases

| Situation                                                             | Action                                                                                                                                                               |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                                         | Stop. Ask the user to initialise the project first.                                                                                                                  |
| Default branch is not `main`                                          | Detect via `git symbolic-ref refs/remotes/origin/HEAD` or `git config init.defaultBranch`; substitute the branch name in the `branches:` filter. **[wait for user]** |
| `package.json` `private: true`                                        | Surface this — `npm publish` will refuse. Ask whether to abort or proceed (user may flip `private` later).                                                           |
| `use-lerna: true` but no `lerna.json`                                 | Stop and ask the user to install/initialise Lerna first, or set `use-lerna: false`.                                                                                  |
| Repo has branch protection that blocks the `github-actions[bot]` push | Surface this and recommend the user adds the bot as a bypass actor or uses a PAT-backed `github-token`.                                                              |
| Existing caller present                                               | Per step 2: ask replace / rename / abort. Never silently overlay.                                                                                                    |

## Reference

- Source workflow: [`.github/workflows/reusable-npm-publish.yml`](https://github.com/jabranr/workflows/blob/main/.github/workflows/reusable-npm-publish.yml)
- README section: [`reusable-npm-publish.yml`](https://github.com/jabranr/workflows/blob/main/README.md#reusable-npm-publishyml)
- Companion skills: `jabraf-workflows-pr-checks` (CI on PR + optional pre-release), `jabraf-workflows-actionlint` (lint this file)
