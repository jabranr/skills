---
name: jabraf-eslint
description: Set up ESLint in a project using `@jabraf/dev`'s shared base config. Load when the user asks to add ESLint, set up linting, configure `eslint.config.{js,ts}`, or wire up `@jabraf/dev` ESLint specifically. Do not load for general linter questions unrelated to `@jabraf/dev`.
---

# `jabraf-eslint`

Adds ESLint to the current project by re-exporting `baseEslintConfig` from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The base config
auto-ignores `dist`, `build`, and `node_modules` and bundles recommended rules
for JavaScript, TypeScript, and React.

The canonical setup snippet lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#eslint).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "ESLint", "linting", "`eslint.config`"
- "flat config", "ESLint 9"
- "`@jabraf/dev` ESLint", "jabraf eslint"

Do not load for non-ESLint static-analysis tools (Biome, Oxlint, etc.) or for
general "fix my lint errors" requests that don't involve `@jabraf/dev`. Do not
load alongside `jabraf-dev-setup` — the umbrella will invoke this one.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response.

1. **Brief acknowledge.** One sentence: "I'll add ESLint via `@jabraf/dev`.
   That's: detect package manager, install the dep if missing, write
   `eslint.config.ts` (or `.js`), add a `lint` script, validate. Proceed?"
   **[wait for user]**

2. **Detect package manager.** `pnpm-lock.yaml` → pnpm; `yarn.lock` → yarn; `package-lock.json` → npm. If none, default to npm and say so. If multiple, ask. **[wait for user if ambiguous]**

3. **Detect existing config.** Check for any of `eslint.config.{js,cjs,mjs,ts,mts,cts}`, `.eslintrc`, `.eslintrc.{js,cjs,json,yaml,yml}`, or an `eslintConfig` field in `package.json`. If found, show the contents and ask: "An existing ESLint config was found. Replace with the `@jabraf/dev` re-export, leave it alone, or keep both?" **[wait for user]** Never overwrite silently. Legacy `.eslintrc*` files conflict with the flat config from `@jabraf/dev` (ESLint 9+) — flag this if detected and recommend deleting after the user confirms.

4. **Install `@jabraf/dev` if missing.** Check `dependencies` and `devDependencies` in `package.json`. If absent, install as a dev dep at `latest`:
   - npm: `npm install --save-dev @jabraf/dev`
   - yarn: `yarn add --dev @jabraf/dev`
   - pnpm: `pnpm add --save-dev @jabraf/dev`

5. **Choose config file extension.** Default to `eslint.config.ts` if the project already uses TypeScript (presence of `typescript` in deps or any `tsconfig.json`), otherwise `eslint.config.js`. Confirm the choice if you're not sure. Write it at the project root with this exact body:

   ```ts
   import baseEslintConfig from '@jabraf/dev/eslint';

   export default baseEslintConfig;
   ```

   Both default and named (`baseEslintConfig`) exports are available; the default form above matches the README.

6. **Add scripts.** Add to `package.json` `scripts`, **only if absent**:

   ```jsonc
   {
     "scripts": {
       "lint": "eslint .",
     },
   }
   ```

   If the user has source segregated under `src/`, propose `eslint src` instead. **[wait for user if conflict]**

7. **Validate.** Run `<pm> run lint`. Report the outcome:
   - Exit 0: "ESLint is set up and the codebase passes the base ruleset."
   - Non-zero with rule violations: "ESLint is set up. The base ruleset reports N issue(s). Run `lint --fix` when you're ready, or open them up to triage."
   - Non-zero with a module/parser error: surface the error and stop.

8. **Final report.** Summarize: package manager detected, install status, config file written, scripts added, validation outcome.

## Things you must NOT do

- Do not overwrite an existing ESLint config without explicit confirmation.
- Do not delete legacy `.eslintrc*` files without explicit confirmation.
- Do not overwrite existing `package.json` scripts without explicit confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not run `lint --fix` as part of setup. Validation is read-only.
- Do not edit project source files. Only `eslint.config.{js,ts}` and `package.json` `scripts`.

## Edge cases

| Situation                                 | Action                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project has no `package.json`             | Stop. Ask the user to initialise the project first (`npm init -y`).                                                                                          |
| Both flat and legacy ESLint configs exist | Flag explicitly. The flat config (`eslint.config.*`) wins under ESLint 9+, but the legacy `.eslintrc*` will confuse editors and CI. Ask before deleting.     |
| Project uses ESLint < 9                   | The base config is ESLint 9+ flat-config only. Warn the user that `@jabraf/dev`'s config requires ESLint 9+, and ask whether to upgrade. **[wait for user]** |
| Monorepo (`workspaces` present)           | Ask whether to add at the repo root, in a specific workspace, or both. **[wait for user]** Repeat steps 3–7 in each chosen location.                         |
| Existing `.eslintignore`                  | Leave it alone. Note: flat config ignores live inside `eslint.config.*`; the base config's built-in ignores cover `dist`, `build`, `node_modules`.           |
| Network/install failure                   | Surface the package manager error verbatim and stop. Do not retry silently.                                                                                  |

## Reference

- `@jabraf/dev` ESLint docs: [`packages/jabraf-dev/README.md#eslint`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#eslint)
- Subpath export: `@jabraf/dev/eslint` → `./dist/config/code-linting/eslint.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Both default and named (`baseEslintConfig`) exports are available.
