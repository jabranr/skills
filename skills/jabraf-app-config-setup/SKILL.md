---
name: jabraf-app-config-setup
description: Set up `@jabraf/app-config` end-to-end in a project — install the runtime dep, scaffold `config/make-config.ts`, augment the `FeatureMap`, gitignore the generated artifact, add `prebuild`/`predev` scripts, wire the bootstrap `setConfig` call, and (React apps) mount the in-app `FeatureFlagsPanel` toggle UI. Load when the user asks to add app config, set up feature flags, configure `@jabraf/app-config`, wire `jabraf-config build`, or add a feature flags toggle panel / floating button.
---

# `jabraf-app-config-setup`

End-to-end setup for
[`@jabraf/app-config`](https://www.npmjs.com/package/@jabraf/app-config) — a
lightweight config + feature-flag layer for Node, browser, and React apps.

Canonical setup, API, and CLI reference live in
[`packages/app-config/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/app-config/README.md).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "`@jabraf/app-config`", "jabraf app config", "jabraf-config build"
- "feature flags" + (set up / add / wire)
- "`make-config.ts`", "`app-config.json`"
- "runtime config" + (browser + Node, or universal)
- "feature flags panel", "toggle feature flags in the app / on mobile", "`FeatureFlagsPanel`", "`?ffs=1`"

Do not load for unrelated config libraries (dotenv, node-config, convict) or
for runtime-config questions that don't involve `@jabraf/app-config`.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response.

1. **Brief acknowledge + framework probe.** Read `package.json` once and
   detect:
   - Package manager (lockfile)
   - Framework: `next`, `vite`, `remix`, `nuxt`, `astro` → "web app"; React present without bundler → "lib"; otherwise → "node"
   - TypeScript present (`typescript` in deps or any `tsconfig.json`)
   - `package.json` `type` field (`"module"` vs missing/`"commonjs"`)
   - React present (controls whether to wire the `useFeature` hook and offer the `FeatureFlagsPanel`)

   One sentence: "I'll set up `@jabraf/app-config`. That covers: install (runtime dep), scaffold `config/make-config.ts`, augment `FeatureMap`, gitignore `config/app-config.json`, add `prebuild`/`predev` scripts, wire the bootstrap `setConfig` call<, mount `FeatureFlagsPanel` (React only)>. Detected `<framework>` with `<typescript|js>`. Proceed?" **[wait for user]**

2. **Detect existing setup.** Look for:
   - `config/make-config.ts` (or `.js`, `.mjs`)
   - `config/app-config.json`
   - Any `**/features.d.ts` or `**/feature.d.ts` (FeatureMap augmentation)
   - `setConfig(` call sites in source
   - `prebuild` / `predev` / `config:build` / `config:watch` scripts in `package.json`
   - `config/app-config.json` line in `.gitignore`
   - `<FeatureFlagsPanel` usage in source (React only)

   If anything exists, present a per-item table: "Found / Missing — proposed action: write / skip / merge". Ask once: "Confirm I should write the `missing` items and leave the `found` items alone?" **[wait for user]** Never overwrite silently. Never merge JSON / `.d.ts` files programmatically.

3. **Install `@jabraf/app-config` if missing.** This is a **runtime dependency**, not dev:
   - npm: `npm install @jabraf/app-config`
   - yarn: `yarn add @jabraf/app-config`
   - pnpm: `pnpm add @jabraf/app-config`

   Install at `latest` (no pin). If React is present and the user wants the `useFeature` hook, confirm `react` is already installed (it is an optional peer; do not install React on the user's behalf).

4. **Scaffold `config/make-config.ts`.** Create the `config/` directory if absent and write `make-config.ts` with this skeleton:

   ```typescript
   import type { AppConfig, BuildAppConfig, EnvironmentConfig } from '@jabraf/app-config';

   const configByEnv: EnvironmentConfig<AppConfig> = {
     dev: { env: 'dev', hostname: 'localhost:3000', features: {} },
     test: { env: 'test', hostname: 'test.example.com', features: {} },
     staging: { env: 'staging', hostname: 'staging.example.com', features: {} },
     production: { env: 'production', hostname: 'example.com', features: {} },
   };

   export const buildAppConfig: BuildAppConfig = async (env) => configByEnv[env] ?? null;
   ```

   Ask the user to confirm the hostnames before writing, or leave the placeholders for them to fill in later. **[wait for user]**

5. **Scaffold the `FeatureMap` augmentation.** Pick a placement based on the framework probe:
   - Next.js (`app/` router) → `app/types/features.d.ts`
   - Next.js (`pages/` router) → `types/features.d.ts`
   - Vite / Remix / Astro / generic React → `src/types/features.d.ts`
   - Node lib → `src/types/features.d.ts` (create `src/` if absent)

   Confirm the path. **[wait for user]** Write:

   ```typescript
   declare global {
     interface FeatureMap {
       // 'beta': true;
       // 'experimental-search': true;
     }
   }

   export {};
   ```

   Remind the user that adding entries here drives the `Feature` type everywhere `@jabraf/app-config` is consumed. Without at least one entry, `Feature` resolves to `never` and `isFeatureEnabled(...)` won't type-check.

6. **Update `.gitignore`.** Append (creating the file if missing):

   ```gitignore
   # config build output from @jabraf/app-config
   config/app-config.json
   ```

   Skip if the line is already present. Show the diff before writing.

7. **Add scripts.** Add to `package.json` `scripts`, only if absent:

   ```jsonc
   {
     "scripts": {
       "config:build": "jabraf-config build",
       "config:watch": "jabraf-config build --watch",
       "prebuild": "jabraf-config build",
       "predev": "jabraf-config build",
     },
   }
   ```

   - If the user has a custom `build` / `dev` script that already calls something like `jabraf-config build`, skip the `prebuild` / `predev` additions.
   - For dev-server integrations (Vite, Next.js), offer the `concurrently`-based pattern from the README as an alternative to `predev` — show the snippet, **do not install `concurrently`** without consent. **[wait for user if conflict]**

8. **Wire the bootstrap `setConfig` call.** Identify the app's entry file (`src/main.ts(x)`, `src/index.ts(x)`, `app/layout.tsx`, `pages/_app.tsx`, `server.ts`, etc.). Confirm the chosen file with the user. **[wait for user]** Insert at the top:

   ```typescript
   import appConfig from '../config/app-config.json' with { type: 'json' };
   import { setConfig } from '@jabraf/app-config';

   setConfig(appConfig);
   ```

   Notes:
   - Drop the `with { type: 'json' }` assertion for CommonJS bundlers or older Node.
   - If `tsconfig.json` lacks `"resolveJsonModule": true`, surface the gap (it is on by default in `@jabraf/dev`, Vite, and Next.js).
   - On a fresh clone, `config/app-config.json` does not exist until `jabraf-config build` runs once. Mention the three recovery options from the README (commit a `{}` placeholder, run `jabraf-config build` before typecheck, or `// @ts-expect-error`).

9. **Mount `FeatureFlagsPanel` (React only, optional).** Skip entirely if React is absent. Ask: "Add the in-app feature flags panel? It's a floating button listing every flag with a checkbox to override it (via `feature__{name}` cookies). Hidden in every env until enabled with `?ffs=1` or 5 taps in the bottom-right corner." **[wait for user]** If yes, pick the root component (the one that renders the whole app: `src/App.tsx`, `app/layout.tsx`, `pages/_app.tsx`, `app/root.tsx`) and confirm it. **[wait for user]** Show the diff, then insert:

   ```tsx
   import { FeatureFlagsPanel } from '@jabraf/app-config/components/feature-flags-panel.js';

   // render once, as a sibling of the app tree
   <FeatureFlagsPanel />;
   ```

   Notes:
   - Render it once, after `setConfig` has run (it reads `getConfig().features`).
   - It is SSR-safe (renders nothing on the server) and the module is marked `'use client'`, so it can be rendered directly from a server `layout.tsx` (Next.js `app/` router). It reads `getConfig()` in the browser, so `setConfig` must also run in client code — flag it if the bootstrap from step 8 is server-only.
   - Defaults are fine for most apps. Only pass props the user asks for: `position` (`'bottom-right'` default / `'bottom-left'` / `'top-right'` / `'top-left'`), `draggable` (default `true`), `queryParam` (default `'ffs'`), `gestureTaps` (default `5`, `0` disables the gesture), `onChange` (default reloads the page after a flag change).
   - Tell the user how to open it: visit any page with `?ffs=1` (`?ffs=0` to disable) or tap the bottom-right corner 5 times within 3s. It stays enabled via an `ffs` cookie until **Hide** is pressed.

10. **First build.** Run `npx jabraf-config build` to produce `config/app-config.json`. Report the outcome:

- File written → "First build succeeded. `config/app-config.json` now exists locally and is gitignored."
- Error: missing export → surface the readme-quoted error (`export buildAppConfig method from config/make-config.ts`) and stop.
- Error: `buildAppConfig` returned nullish → surface the readme-quoted error and stop.

11. **Validate** (only if a typecheck script is already present from `jabraf-tsconfig` or similar): run `<pm> run typecheck`. Report. Do not auto-fix.

12. **Final report.** Summarize: framework detected, install status, files written (paths), scripts added, bootstrap site, `FeatureFlagsPanel` site (or skipped), first build outcome, typecheck outcome.

## Things you must NOT do

- Do not install `@jabraf/app-config` as a `devDependency`. It is a runtime dep.
- Do not install `react` on the user's behalf. The `useFeature` hook is opt-in; `react` is an optional peer dep.
- Do not declare or re-declare the `Feature` type directly — only augment `FeatureMap`. Redeclaring `Feature` produces `Duplicate identifier 'Feature'`.
- Do not commit `config/app-config.json`. It is a build artifact.
- Do not overwrite existing source files at the bootstrap site (step 8) — insert only, and show the diff first.
- Do not modify the user's `tsconfig.json` to flip `resolveJsonModule` without explicit consent (delegate to `jabraf-tsconfig` if needed).
- Do not install `concurrently` or any dev-server integration tooling without consent.
- Do not gate `FeatureFlagsPanel` behind an env check (`NODE_ENV`, `config.env`). It is designed to be mounted in every env and stays hidden until enabled via `?ffs=1` or the corner gesture, so testers can use it in production on mobile.
- Do not present `FeatureFlagsPanel` (or feature cookies) as access control. Anyone can enable it and set cookies; flags should only toggle UI. Say so if the user wants to hide paid or privileged features behind a flag.
- Do not commit, push, or open PRs at any step.

## Edge cases

| Situation                                                                                                    | Action                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project has no `package.json`                                                                                | Stop. Ask the user to initialise the project first.                                                                                                                |
| `config/` directory already contains unrelated files                                                         | Surface them. Ask whether `config/` is safe to extend, or whether to use a different directory name (note: the library's defaults assume `config/`).               |
| `make-config.ts` already exists with a different shape                                                       | Do not overwrite. Show the existing file and ask the user to decide. The library requires an exported `buildAppConfig`; flag if missing.                           |
| Existing `FeatureMap` augmentation found elsewhere                                                           | Use that file. Do not write a new one. Add entries with consent.                                                                                                   |
| User on CommonJS Node (no `"type": "module"`)                                                                | Drop the `with { type: 'json' }` JSON import assertion. Note that `make-config.ts` is loaded via the `tsx` ESM loader at runtime regardless.                       |
| First build fails with module resolution error for `tsx`                                                     | The `tsx` loader is bundled with `@jabraf/app-config`. Surface the raw error and stop.                                                                             |
| Monorepo (`workspaces` present)                                                                              | Run the full sequence per workspace that needs config. Ask once on step 1 whether to apply at root, per-workspace, or both. **[wait for user]** Do not interleave. |
| User wants per-environment overrides beyond the four supported envs (`dev`, `test`, `staging`, `production`) | Out of scope. Tell the user to compose their own switching logic inside `buildAppConfig`.                                                                          |
| User asks to wire the React `useFeature` hook into a specific component                                      | Out of scope for setup. Mention the import path (`@jabraf/app-config/hooks/use-feature.js`) and let the user wire it themselves.                                   |
| User wants the flags panel only in dev                                                                       | Explain it is hidden by default in every env already. If they still insist, they can wrap it in their own condition; don't add one unprompted.                     |
| Installed `@jabraf/app-config` version has no `components/feature-flags-panel.js` export                     | The panel ships in a newer release. Offer to upgrade the dep (`<pm> install @jabraf/app-config@latest`) **[wait for user]**, or skip step 9.                       |
| Non-React app (Vue, Svelte, plain JS) wants a flags toggle UI                                                | Out of scope: the panel is React-only. Mention `setFeatureCookie` / `removeFeatureCookie` / `getFeatureOverride` as building blocks.                               |

## Reference

- `@jabraf/app-config` docs: [`packages/app-config/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/app-config/README.md) (entry points, layout, `FeatureMap`, `buildConfig`, CLI, recipes)
- Entry points map:
  - Universal: `@jabraf/app-config` (`setConfig`, `getConfig`, `resetConfig`, types)
  - React hook: `@jabraf/app-config/hooks/use-feature.js` (`useFeature`, `setFeatureCookie`, `removeFeatureCookie`, `getFeatureOverride`)
  - React component: `@jabraf/app-config/components/feature-flags-panel.js` (`FeatureFlagsPanel`)
  - Node build: `@jabraf/app-config/build` (`buildConfig`, `appDirectory`, `fromRoot`)
- CLI: `jabraf-config build [--watch | -w]` (build once; debounced watcher rebuilds on `config/` changes, ignores its own output file)
- Companion skills in this repo: `jabraf-tsconfig` (ensures `resolveJsonModule`), `jabraf-dev-setup` (full `@jabraf/dev` stack — independent of app-config)
