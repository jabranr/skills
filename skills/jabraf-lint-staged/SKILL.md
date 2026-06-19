---
name: jabraf-lint-staged
description: Set up lint-staged in a project using `@jabraf/dev`'s shared base (runs Prettier on stage, then ESLint + related Vitest specs), wired through Husky for the `pre-commit` hook. Load when the user asks to add lint-staged, configure `.lintstagedrc`, set up a `pre-commit` hook for staged files, or wire up `@jabraf/dev` lint-staged specifically.
---

# `jabraf-lint-staged`

Adds [lint-staged](https://github.com/lint-staged/lint-staged) to the current
project by re-exporting `baseLintStagedConfig` from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The base config:

- `prettier --write` for staged `*.{js,mjs,ts,mts,jsx,tsx,md,yaml,yml,json,xml}`
- `eslint` and `vitest run related --bail 0 --passWithNoTests` for staged `*.{js,ts,mjs,mts,jsx,tsx}`

Canonical setup lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#lintstaged).

## When to load this skill

Load when the user's prompt mentions any of:

- "lint-staged", "staged files", "`.lintstagedrc`"
- "`pre-commit` hook" + (lint / format / test)
- "`@jabraf/dev` lint-staged", "jabraf lint-staged"

Do not load alongside `jabraf-dev-setup` — the umbrella will invoke this one.

## Conversation flow

1. **Brief acknowledge.** One sentence: "I'll add lint-staged via `@jabraf/dev`. That's: detect package manager, install the dep if missing, write `.lintstagedrc.mjs`, then install Husky and wire the `pre-commit` git hook to invoke `lint-staged` directly. Proceed?" **[wait for user]**

2. **Detect package manager.** Standard logic.

3. **Detect existing config.** Check for `.lintstagedrc{,.json,.yaml,.yml,.js,.cjs,.mjs,.ts,.mts}`, `lint-staged.config.{js,cjs,mjs,ts,mts}`, or a `lint-staged` field in `package.json`. If found, show contents and ask: "Replace with the `@jabraf/dev` re-export, leave alone, or compose with `lintStagedCommands`?" **[wait for user]** Never overwrite silently.

4. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`. `lint-staged` itself comes transitively.

5. **Pre-flight the base config's expectations.** The base config invokes `prettier`, `eslint`, and `vitest`. Verify each is reachable:
   - Prettier — install `jabraf-prettier` if absent (or warn the user).
   - ESLint — install `jabraf-eslint` if absent (or warn the user).
   - Vitest — install `jabraf-vitest` if absent (or warn the user).

   If any are missing, ask: "The base lint-staged config runs Prettier, ESLint, and Vitest. `<missing>` is not yet configured. Continue anyway (commands will fail until you set them up), set them up first via the related skill(s), or pick the compose path (`lintStagedCommands`)?" **[wait for user]**

6. **Write `.lintstagedrc.mjs`.** Default (full base) body:

   ```js
   import baseLintStagedConfig from '@jabraf/dev/lint-staged';

   export default baseLintStagedConfig;
   ```

   Compose path (only if the user wants a subset, e.g. eslint + tsc only):

   ```js
   import { lintStagedCommands } from '@jabraf/dev/lint-staged';

   export default {
     '*.{js,ts,mjs,mts,jsx,tsx}': (files) => [lintStagedCommands.eslint(files), lintStagedCommands.tsc()],
   };
   ```

   Available helpers: `lintStagedCommands.{eslint, tsc, vitest, prettier}`. Confirm the chosen variant. **[wait for user]**

7. **Install Husky.** lint-staged does nothing on its own — it needs a `pre-commit` hook, and this skill standardises on [Husky](https://typicode.github.io/husky/). If Husky is already installed and initialised (`.husky/` exists), skip to step 8. Otherwise:

   ```bash
   <pm> install --save-dev husky
   <pm-exec> husky init
   ```

   `husky init` adds a `prepare` script to `package.json` and writes a default `.husky/pre-commit` that runs `npm test`. If a different git-hook manager (e.g. `simple-git-hooks`, `lefthook`) is already configured, stop and ask the user before proceeding. **[wait for user if conflict]**

8. **Wire the hook.** Replace the body of `.husky/pre-commit` with the user's package manager equivalent of:

   ```bash
   npx lint-staged
   ```

   Use the package manager's exec form (`npx` for npm, `yarn` for yarn, `pnpm exec` for pnpm). Do **not** add a `precommit` npm script — the hook invokes `lint-staged` directly. If the file already contains other commands, show the diff and ask whether to append or replace. **[wait for user if conflict]**

9. **Validate.** Dry-run lint-staged against the most recent commit:

   ```bash
   npx lint-staged --diff="HEAD~1 HEAD" 2>&1 | head -20
   ```

   If no staged changes are present, simulate with `--allow-empty`. Report whether the configured commands resolved successfully. Do not actually commit.

10. **Final report.** Summarize: package manager, install status, config variant (full base vs. composed), Husky install/init status, hook body wired, validation outcome.

## Things you must NOT do

- Do not overwrite an existing lint-staged config without explicit confirmation.
- Do not add a `precommit` (or equivalent) `package.json` script — the Husky hook invokes `lint-staged` directly.
- Do not overwrite the `prepare` script written by `husky init` or any other existing `package.json` scripts without confirmation.
- Do not swap out an existing non-Husky git-hook manager (`simple-git-hooks`, `lefthook`, etc.) without explicit confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not modify an existing `.husky/pre-commit` body that contains other commands without showing the diff and confirming.
- Do not run a real commit during validation — dry-run only.
- Do not edit project source files.

## Edge cases

| Situation                                            | Action                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                        | Stop. Ask the user to initialise the project first.                                                                                               |
| Project has no `.git` directory                      | Surface this. Offer to write the config anyway and skip the Husky step. **[wait for user]**                                                       |
| Prettier / ESLint / Vitest not yet configured        | Either install the matching `jabraf-*` skill flow first, or switch to the compose path with only the helpers that match installed tools.          |
| `simple-git-hooks` or `lefthook` already installed   | Block. Ask whether to replace with Husky or keep the existing manager (in which case skip Husky install and just wire the equivalent hook there). |
| User already has a `prepare` script invoking Husky   | Leave it alone. Only adjust the `.husky/pre-commit` body.                                                                                         |
| Existing `.husky/pre-commit` runs different commands | Show the diff and ask whether to append or replace. **[wait for user]**                                                                           |
| Monorepo (`workspaces` present)                      | Apply at the repo root by default. lint-staged operates on staged files regardless of workspace. Do not duplicate per-workspace unless asked.     |

## Reference

- `@jabraf/dev` lint-staged docs: [`packages/jabraf-dev/README.md#lintstaged`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#lintstaged)
- Subpath export: `@jabraf/dev/lint-staged` → `./dist/config/code-linting/lint-staged.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Named exports: `baseLintStagedConfig` (default), `lintStagedCommands` ({ eslint, tsc, vitest, prettier })
