---
name: jabraf-oxlint
description: Set up oxlint in a project using `@jabraf/dev`'s shared base config, either on its own or alongside ESLint. Load when the user asks to add oxlint, set up `oxlint.config.ts` / `.oxlintrc.json`, speed up linting with oxlint, or wire up `@jabraf/dev` oxlint specifically.
---

# `jabraf-oxlint`

Adds [oxlint](https://oxc.rs/docs/guide/usage/linter) to the current project
by re-exporting `baseOxlintConfig` from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The base config:

- enables the `eslint`, `typescript`, `unicorn`, `oxc` and `react` (incl. React Hooks) plugins
- sets the `correctness` category to `error`
- enables browser + node + ES2024 globals
- ignores `dist`, `build`, and `node_modules`

For customisation the package also exposes a `createBaseOxlintConfig()` factory.
`baseOxlintConfig` is simply `createBaseOxlintConfig()` with defaults. `oxlint`
itself ships as a dependency of `@jabraf/dev`.

The canonical setup snippet lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#oxlint).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "oxlint", "oxc linter", "`oxlint.config`", "`.oxlintrc`"
- "faster linting", "run oxlint alongside ESLint"
- "`@jabraf/dev` oxlint", "jabraf oxlint"

Do not load for Biome or other non-oxlint tools. For ESLint-only setup, load
`jabraf-eslint`. When the user wants both, run `jabraf-eslint` first, then this
skill.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response.

1. **Brief acknowledge + mode.** One sentence: "I'll add oxlint via `@jabraf/dev`.
   That's: detect package manager, install the dep if missing, write
   `oxlint.config.ts`, add a `lint` script, validate." Then ask which mode:
   - **Alongside ESLint** (recommended when `eslint.config.*` exists): oxlint runs first, ESLint skips rules oxlint covers.
   - **Oxlint only**: no ESLint.

   **[wait for user]**

2. **Detect package manager.** `pnpm-lock.yaml` → pnpm; `yarn.lock` → yarn; `package-lock.json` → npm. If none, default to npm and say so. If multiple, ask. **[wait for user if ambiguous]**

3. **Detect existing config.** Check for `oxlint.config.{ts,mts,js,mjs}`, `.oxlintrc.json`, `.oxlintrc.jsonc`. If found, show contents and ask: "Replace with the `@jabraf/dev` re-export, leave it alone, or keep both?" **[wait for user]** Never overwrite silently.

4. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`:
   - npm: `npm install --save-dev @jabraf/dev`
   - yarn: `yarn add --dev @jabraf/dev`
   - pnpm: `pnpm add --save-dev @jabraf/dev`

   If the project has its own direct `oxlint` dep, leave it, but note that `@jabraf/dev` pins `oxlint ~1.90` to match `eslint-plugin-oxlint`.

5. **Write `oxlint.config.ts`** at the project root:

   ```ts
   import baseOxlintConfig from '@jabraf/dev/oxlint';

   export default baseOxlintConfig;
   ```

   For a non-React project, or to add plugins/rules on top of the base, use the factory:

   ```ts
   import { createBaseOxlintConfig } from '@jabraf/dev/oxlint';

   export default createBaseOxlintConfig({
     react: false,
     plugins: ['vitest'],
     categories: { suspicious: 'warn' },
     rules: { 'no-console': 'warn' },
   });
   ```

   Factory options (all optional):

   | Option       | Type                         | Default                    | Notes                                              |
   | ------------ | ---------------------------- | -------------------------- | -------------------------------------------------- |
   | `ignores`    | `string[]`                   | `[]`                       | Extra globs appended to the built-in ignores       |
   | `react`      | `boolean`                    | `true`                     | `react` plugin (React + Hooks); `false` to drop it |
   | `plugins`    | `string[]`                   | `[]`                       | Extra built-in oxlint plugins (deduped)            |
   | `categories` | `OxlintConfig['categories']` | `{ correctness: 'error' }` | Category severities merged over the default        |
   | `globals`    | `OxlintConfig['globals']`    | `{}`                       | Extra globals                                      |
   | `rules`      | `OxlintConfig['rules']`      | `{}`                       | Rules applied on top of the base config            |
   | `overrides`  | `OxlintConfig['overrides']`  | `[]`                       | Per-file overrides                                 |

   TS config files are an experimental oxlint feature (requires running via Node, which `npx oxlint` does). If it fails to load, fall back to `.oxlintrc.json` with the output of `npx oxlint --print-config` and tell the user.

6. **Alongside ESLint only: update `eslint.config.*`.** Switch the ESLint config to the factory with `oxlint: true` so ESLint skips rules oxlint already enforces:

   ```ts
   import { createBaseEslintConfig } from '@jabraf/dev/eslint';

   export default createBaseEslintConfig({ oxlint: true });
   ```

   Keep any existing factory options (`react`, `ignores`, `rules`, ...). If the oxlint config is customised, pass that same object instead of `true`. Show the diff and confirm. **[wait for user]**

7. **Add scripts.** Only if absent (or confirm the change):
   - Oxlint only: `"lint": "oxlint ."` (or `oxlint src` when source lives under `src/`)
   - Alongside ESLint: `"lint": "oxlint src && eslint src"` (oxlint first for fast feedback)

   **[wait for user if conflict]**

8. **lint-staged (if configured).** If `.lintstagedrc*` re-exports `@jabraf/dev/lint-staged`, offer to switch to `createBaseLintStagedConfig({ linter: 'both' })` (or `'oxlint'` for oxlint only). See `jabraf-lint-staged`. **[wait for user]**

9. **Validate.** Run `<pm> run lint`. Report:
   - Exit 0: "oxlint is set up and the codebase passes."
   - Non-zero with violations: report the count; oxlint often catches issues ESLint misses (e.g. `no-unsafe-optional-chaining`). Do not auto-fix.
   - Config/load error: surface it and stop.

10. **Final report.** Summarize: mode, package manager, install status, config file(s) written/changed, scripts added, lint-staged change, validation outcome.

## Things you must NOT do

- Do not overwrite an existing oxlint or ESLint config without explicit confirmation.
- Do not remove ESLint when the user picked "alongside".
- Do not overwrite existing `package.json` scripts without confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not run `oxlint --fix` as part of setup. Validation is read-only.
- Do not edit project source files.

## Edge cases

| Situation                            | Action                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`        | Stop. Ask the user to initialise the project first (`npm init -y`).                                                              |
| Oxlint only, React project           | Note that oxlint's React Hooks coverage is narrower than `eslint-plugin-react-hooks` (e.g. rules-of-hooks); suggest "alongside". |
| ESLint config not from `@jabraf/dev` | Can't use `oxlint: true`. Suggest adding `eslint-plugin-oxlint` manually, or running `jabraf-eslint` first. **[wait for user]**  |
| Monorepo (`workspaces` present)      | Ask whether to add at the root, a specific workspace, or each workspace. **[wait for user]** Repeat steps 3–9 per location.      |
| Network/install failure              | Surface the package manager error verbatim and stop. Do not retry silently.                                                      |

## Reference

- `@jabraf/dev` oxlint docs: [`packages/jabraf-dev/README.md#oxlint`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#oxlint)
- Subpath export: `@jabraf/dev/oxlint` → `./dist/config/code-linting/oxlint.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Exports: `createBaseOxlintConfig` (factory) and `baseOxlintConfig` (named and default).
- ESLint integration: `createBaseEslintConfig({ oxlint })` from `@jabraf/dev/eslint`, via `eslint-plugin-oxlint`.
- lint-staged integration: `createBaseLintStagedConfig({ linter: 'oxlint' | 'both' })`, `lintStagedCommands.oxlint`.
