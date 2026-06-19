---
name: jabraf-commitlint
description: Set up commitlint in a project using `@jabraf/dev`'s shared base (conventional commits). Load when the user asks to add commitlint, enforce conventional commits, configure `commitlint.config.js`, or wire up `@jabraf/dev` commitlint specifically. Do not load for general commit-message-quality questions unrelated to `@jabraf/dev`.
---

# `jabraf-commitlint`

Adds [commitlint](https://commitlint.js.org/) to the current project by
re-exporting `baseCommitLintConfig` from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The base config
enforces [Conventional Commits](https://www.conventionalcommits.org/) via
`@commitlint/config-conventional`.

Canonical setup lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#commit-lint).

## When to load this skill

Load when the user's prompt mentions any of:

- "commitlint", "conventional commits"
- "commit message linter", "`commit-msg` hook"
- "`@jabraf/dev` commitlint", "jabraf commitlint"

Do not load for unrelated commit-quality tools (changesets, release-please)
unless the user also asks for commitlint. Do not load alongside
`jabraf-dev-setup` — the umbrella will invoke this one.

## Conversation flow

1. **Brief acknowledge.** One sentence: "I'll add commitlint via `@jabraf/dev` (Conventional Commits). That's: detect package manager, install the dep if missing, write `commitlint.config.js`, then surface options for the `commit-msg` git hook. Proceed?" **[wait for user]**

2. **Detect package manager.** Standard logic.

3. **Detect existing config.** Check for `commitlint.config.{js,cjs,mjs,ts,mts}`, `.commitlintrc{,.json,.yaml,.yml,.js,.cjs,.mjs,.ts}`, or a `commitlint` field in `package.json`. If found, show contents and ask: "Replace with the `@jabraf/dev` re-export, leave alone, or merge?" **[wait for user]** Never overwrite silently.

4. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`. `@commitlint/cli` and `@commitlint/config-conventional` come transitively.

5. **Write `commitlint.config.js`.** Body:

   ```js
   import baseCommitLintConfig from '@jabraf/dev/commitlint';

   export default baseCommitLintConfig;
   ```

   Use `.js` (not `.mjs`) when `package.json` has `"type": "module"`; switch to `.mjs` otherwise so the ESM import works. Confirm before writing if `type` is unset. **[wait for user if ambiguous]**

6. **Surface git-hook options.** commitlint does nothing on its own — it needs a `commit-msg` hook to run. Present the choices and let the user pick **one** (do not install or configure without consent):

   - **Husky** (most common): `npm install --save-dev husky && npx husky init` then add the hook file.
   - **simple-git-hooks** (lightweight): `npm install --save-dev simple-git-hooks` then add the `simple-git-hooks` block to `package.json`.
   - **Lefthook** (Go binary, fast): `npm install --save-dev lefthook` then `lefthook.yml`.
   - **None** — user already has a git-hook manager or wants to wire it manually.

   **[wait for user]**

7. **Wire the hook** (only if the user chose a manager). The exact body the hook needs to run:

   ```bash
   npx --no -- commitlint --edit "$1"
   ```

   - **Husky**: write `.husky/commit-msg` with that line, `chmod +x`.
   - **simple-git-hooks**: add to `package.json`:
     ```jsonc
     {
       "simple-git-hooks": {
         "commit-msg": "npx --no -- commitlint --edit \"$1\"",
       },
     }
     ```
     and run `npx simple-git-hooks` once to register.
   - **Lefthook**: add to `lefthook.yml`:
     ```yaml
     commit-msg:
       commands:
         commitlint:
           run: npx --no -- commitlint --edit {1}
     ```
     and run `npx lefthook install` once.

   Show the diff for each file before writing. **[wait for user]**

8. **Validate.** Echo a sample message through commitlint:

   ```bash
   echo "feat: add new feature" | npx commitlint
   echo "broken message" | npx commitlint
   ```

   Report: "Conventional message accepted; non-conventional rejected. commitlint is wired." If the second command exits 0, something is wrong — surface and stop.

9. **Final report.** Summarize: package manager, install status, config file written, hook manager chosen (or skipped), validation outcome.

## Things you must NOT do

- Do not overwrite an existing commitlint config without explicit confirmation.
- Do not install a git-hook manager without explicit confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not modify existing git hooks (`.husky/*`, `.git/hooks/*`, `lefthook.yml`) without showing the diff and confirming.
- Do not rewrite the user's existing commit history or add a `commitizen` setup unless explicitly asked.
- Do not edit any project source files. Only `commitlint.config.{js,mjs}`, `package.json`, and the chosen hook file.

## Edge cases

| Situation                                                                                                  | Action                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                                                                              | Stop. Ask the user to initialise the project first.                                                                          |
| Project has no `.git` directory                                                                            | Surface this. commitlint runs in a git context; offer to write the config anyway and skip the hook step. **[wait for user]** |
| Husky already installed but no `commit-msg` hook                                                           | Add the hook file only; do not re-run `husky init`.                                                                          |
| User has both Husky and simple-git-hooks installed                                                         | Block and ask which one to use. Don't write conflicting hooks.                                                               |
| Existing hook file already runs commitlint                                                                 | Skip the write. Mention it in the final report.                                                                              |
| Hook needs to run a different commitlint package (e.g., monorepo with root + workspace commitlint configs) | Out of scope for this skill. Ask the user to wire the workspace-specific hook manually.                                      |
| Monorepo (`workspaces` present)                                                                            | Ask whether to lint commits at the repo root (common) or per-workspace (rare). Default to root. **[wait for user]**          |

## Reference

- `@jabraf/dev` commitlint docs: [`packages/jabraf-dev/README.md#commit-lint`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#commit-lint)
- Subpath export: `@jabraf/dev/commitlint` → `./dist/config/code-linting/commit-lint.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Conventional Commits spec: <https://www.conventionalcommits.org/>
