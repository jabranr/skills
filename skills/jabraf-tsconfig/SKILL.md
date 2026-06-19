---
name: jabraf-tsconfig
description: Set up a TypeScript `tsconfig.json` that extends one of `@jabraf/dev`'s presets (`base`, `lib`, `app`, or `node`). Load when the user asks to add TypeScript, configure `tsconfig.json`, or pick a `@jabraf/dev` TSConfig preset. Do not load for general TS questions unrelated to `@jabraf/dev`.
---

# `jabraf-tsconfig`

Writes (or updates) `tsconfig.json` so it extends one of the four presets
shipped by [`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev):

| Preset                      | Use case                            |
| --------------------------- | ----------------------------------- |
| `@jabraf/dev/tsconfig/base` | Shared base — strict, ESM, ES2023   |
| `@jabraf/dev/tsconfig/lib`  | React library (`jsx: react`, emits) |
| `@jabraf/dev/tsconfig/app`  | React application (`jsx: preserve`) |
| `@jabraf/dev/tsconfig/node` | Node.js / bundler targets           |

Canonical table lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#tsconfig).

## When to load this skill

Load when the user's prompt mentions any of:

- "TypeScript config", "`tsconfig.json`"
- "strict TypeScript setup", "ESM TypeScript"
- "`@jabraf/dev` tsconfig", "jabraf tsconfig"

Do not load for general TypeScript questions (writing types, fixing compiler
errors) unrelated to `@jabraf/dev`. Do not load alongside `jabraf-dev-setup` —
the umbrella will invoke this one.

## Conversation flow

1. **Brief acknowledge + preset detection.** Detect the project shape and
   propose a preset:
   - `next` or `vite` in deps → `app`
   - `react` / `react-dom` in deps (no app bundler) → `lib`
   - `bin` field present, or no React/bundler signals → `node`
   - Otherwise → `base`

   One sentence: "I detected `<signal>`, so I'd extend `@jabraf/dev/tsconfig/<preset>`. Use that, or pick a different preset (`base` / `lib` / `app` / `node`)?" **[wait for user]**

2. **Detect package manager.** Same logic as the other `@jabraf/dev` skills. Note it for step 4.

3. **Detect existing `tsconfig.json`.** If it exists, show its current `extends` and `compilerOptions`. Ask: "Replace `extends` with `@jabraf/dev/tsconfig/<preset>` (keeping any local `compilerOptions` / `include` / `exclude` overrides), or write a fresh file?" **[wait for user]** Never overwrite silently. If `extends` already points at a `@jabraf/dev` preset, only update if the user picked a different variant.

4. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`.

5. **Write the config.** Minimum body:

   ```jsonc
   {
     "extends": "@jabraf/dev/tsconfig/<preset>"
   }
   ```

   Preserve any user-supplied `compilerOptions`, `include`, `exclude`, `references`, or `files` fields if updating an existing file. Common additions worth proposing (ask first):
   - `"compilerOptions": { "noEmit": true }` for typecheck-only setups
   - `"include": ["src", "*.ts", "*.mts"]` when the user uses a `src/` layout
   - `"references": [...]` for project-references monorepos — leave untouched unless the user asks

6. **Add a typecheck script** (optional, only if absent):

   ```jsonc
   {
     "scripts": {
       "typecheck": "tsc --noEmit"
     }
   }
   ```

   Ask first if `tsc` should be wired into an existing `test` or `build` script.

7. **Validate.** Run `<pm> run typecheck` (or `npx tsc --noEmit` directly if no script). Report errors. Do not auto-fix.

8. **Final report.** Summarize: preset chosen, signals that drove the choice, install status, config written, scripts added, typecheck outcome.

## Things you must NOT do

- Do not silently switch the preset on an existing `tsconfig.json`.
- Do not strip the user's existing `compilerOptions` overrides.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not run formatters or linters against the config file (Prettier will pick it up later if `jabraf-prettier` is also installed).
- Do not edit any `tsconfig.*.json` (e.g. `tsconfig.build.json`, `tsconfig.eslint.json`) beyond the primary `tsconfig.json` unless the user names them explicitly.

## Edge cases

| Situation | Action |
|---|---|
| Project has no `package.json` | Stop. Ask the user to initialise the project first. |
| Mixed signals (`next` AND a `bin` field, e.g.) | Surface both. Ask the user to pick. **[wait for user]** Default to whichever the user spends more time in (you can ask "Which one is the primary surface of this project?"). |
| Monorepo (`workspaces` present) | Ask whether to apply at the root, in a specific workspace, or both. **[wait for user]** Repeat steps 3–7 in each location. Different workspaces may want different presets. |
| User wants multiple `tsconfig.*.json` (e.g. `tsconfig.build.json`) | Offer to extend the per-file `extends` from `@jabraf/dev/tsconfig/<preset>` too. Confirm each file. |
| `extends` is already an array (TS 5+) | Append the `@jabraf/dev` preset rather than replacing the array. Confirm before writing. |
| Project uses `swc` / `esbuild` with no `tsc` step | Note that the typecheck script still has value for CI even when builds skip `tsc`. Don't add the script if the user declines. |

## Reference

- `@jabraf/dev` TSConfig docs: [`packages/jabraf-dev/README.md#tsconfig`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#tsconfig)
- Subpath exports: `@jabraf/dev/tsconfig/{base,lib,app,node}` — each maps to a JSON file under `./dist/config/typescript/` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)

