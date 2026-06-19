---
name: jabraf-lint-staged
description: Set up lint-staged in a project using `@jabraf/dev`'s shared base (runs Prettier on stage, then ESLint + related Vitest specs). Load when the user asks to add lint-staged, configure `.lintstagedrc`, set up a `pre-commit` hook for staged files, or wire up `@jabraf/dev` lint-staged specifically.
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

1. **Brief acknowledge.** One sentence: "I'll add lint-staged via `@jabraf/dev`. That's: detect package manager, install the dep if missing, write `.lintstagedrc.mjs`, add a `precommit` script, then surface options for the `pre-commit` git hook. Proceed?" **[wait for user]**

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
     '*.{js,ts,mjs,mts,jsx,tsx}': (files) => [
       lintStagedCommands.eslint(files),
       lintStagedCommands.tsc(),
     ],
   };
   ```

   Available helpers: `lintStagedCommands.{eslint, tsc, vitest, prettier}`. Confirm the chosen variant. **[wait for user]**

7. **Add scripts.** Add to `package.json` `scripts`, only if absent:

   ```jsonc
   {
     "scripts": {
       "precommit": "lint-staged"
     }
   }
   ```

   The `precommit` script is the invocation target the git hook will call. **[wait for user if conflict]**

8. **Surface git-hook options.** lint-staged does nothing on its own — it needs a `pre-commit` hook. Present the choices and let the user pick **one** (do not install or configure without consent):

   - **Husky**: `npm install --save-dev husky && npx husky init` (default writes a `pre-commit` hook calling `npm test` — replace its body).
   - **simple-git-hooks**: `npm install --save-dev simple-git-hooks`, add the block to `package.json`, run `npx simple-git-hooks`.
   - **Lefthook**: `npm install --save-dev lefthook`, add to `lefthook.yml`, run `npx lefthook install`.
   - **None** — user already has a git-hook manager or wants to wire it manually.

   **[wait for user]**

9. **Wire the hook.** The hook body always invokes the script:

   ```bash
   npm run precommit
   ```

   - **Husky**: write `.husky/pre-commit` containing `npm run precommit` (or the user's package manager equivalent), `chmod +x`.
   - **simple-git-hooks**: add to `package.json`:
     ```jsonc
     {
       "simple-git-hooks": {
         "pre-commit": "npm run precommit"
       }
     }
     ```
     and run `npx simple-git-hooks` once.
   - **Lefthook**: add to `lefthook.yml`:
     ```yaml
     pre-commit:
       commands:
         lint-staged:
           run: npm run precommit
     ```
     and run `npx lefthook install` once.

   Show the diff for each file before writing. **[wait for user]**

10. **Validate.** Stage a no-op change and dry-run lint-staged:

    ```bash
    npx lint-staged --diff="HEAD~1 HEAD" 2>&1 | head -20
    ```

    If no staged changes are present, simulate with `--allow-empty`. Report whether the configured commands resolved successfully. Do not actually commit.

11. **Final report.** Summarize: package manager, install status, config variant (full base vs. composed), scripts added, hook manager chosen, validation outcome.

## Things you must NOT do

- Do not overwrite an existing lint-staged config without explicit confirmation.
- Do not overwrite existing `package.json` scripts (`precommit`, `prepare`, etc.) without confirmation.
- Do not install a git-hook manager without explicit confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not modify existing git hooks (`.husky/*`, `.git/hooks/*`, `lefthook.yml`) without showing the diff and confirming.
- Do not run a real commit during validation — dry-run only.
- Do not edit project source files.

## Edge cases

| Situation | Action |
|---|---|
| Project has no `package.json` | Stop. Ask the user to initialise the project first. |
| Project has no `.git` directory | Surface this. Offer to write the config anyway and skip the hook step. **[wait for user]** |
| Prettier / ESLint / Vitest not yet configured | Either install the matching `jabraf-*` skill flow first, or switch to the compose path with only the helpers that match installed tools. |
| Both Husky and simple-git-hooks installed | Block. Ask which one to keep. |
| User already has a `prepare` script invoking Husky | Leave it alone. Only add the `pre-commit` body. |
| Existing `pre-commit` hook runs different commands | Show the diff and ask whether to append or replace. **[wait for user]** |
| Monorepo (`workspaces` present) | Apply at the repo root by default. lint-staged operates on staged files regardless of workspace. Do not duplicate per-workspace unless asked. |

## Reference

- `@jabraf/dev` lint-staged docs: [`packages/jabraf-dev/README.md#lintstaged`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#lintstaged)
- Subpath export: `@jabraf/dev/lint-staged` → `./dist/config/code-linting/lint-staged.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Named exports: `baseLintStagedConfig` (default), `lintStagedCommands` ({ eslint, tsc, vitest, prettier })

