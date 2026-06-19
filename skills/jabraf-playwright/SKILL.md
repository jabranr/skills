---
name: jabraf-playwright
description: Set up Playwright in a project using `@jabraf/dev`'s `basePlaywrightConfig` factory. Load when the user asks to add Playwright, set up end-to-end / functional / visual-regression tests, configure `playwright.config.ts`, or wire up `@jabraf/dev` Playwright specifically. Do not load for Cypress, WebdriverIO, or general browser-testing questions unrelated to `@jabraf/dev`.
---

# `jabraf-playwright`

Adds Playwright to the current project via the `basePlaywrightConfig` factory
from [`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The factory
accepts `{ testDir, isFunctional, isCI, baseURL, devServerURL, projects }` and
ships sensible defaults for CI behaviour and browser projects (Chromium /
Desktop Chrome by default).

Canonical setup lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#playwright).

## When to load this skill

Load when the user's prompt mentions any of:

- "Playwright", "end-to-end tests", "e2e tests"
- "functional tests" + browser
- "visual regression" / "VR tests"
- "`@jabraf/dev` playwright", "jabraf playwright"

Do not load for unit tests (use `jabraf-vitest`), API tests, or Cypress /
WebdriverIO requests. Do not load alongside `jabraf-dev-setup` — the umbrella
will invoke this one.

## Conversation flow

1. **Project-shape gate.** Determine whether Playwright is appropriate:
   - Presence of `react`, `vue`, `svelte`, `next`, `vite`, `astro`, `remix`, `nuxt` — proceed.
   - Pure Node library (no browser surface, no UI deps) — stop. Tell the user: "This looks like a pure-Node library with no browser surface. Playwright tests typically target a running web app. Do you have a web frontend / dev server I should target?" **[wait for user]** If no, exit cleanly.

2. **Brief acknowledge + URL detection.** Scan `package.json` `homepage`, `README.md`, and any `wrangler.toml`/`vite.config`/`next.config` for a production hostname. Default `devServerURL` to `http://localhost:3000` for Next/Vite, `http://localhost:5173` for plain Vite, or ask. One sentence: "I'll add Playwright via `@jabraf/dev`. I'll target `<detected dev URL>` for functional tests and `<detected prod URL or none>` for production. OK?" **[wait for user]**

3. **Detect package manager.** Standard logic.

4. **Detect existing config.** Check for `playwright.config.{ts,js,mts,mjs}`. If found, show contents and ask: "Replace with the `@jabraf/dev` factory call, leave alone, or merge?" **[wait for user]** Never overwrite silently.

5. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`. Playwright itself comes transitively.

6. **Write `playwright.config.ts`.** Default body — adjust to the user's chosen setup:

   ```ts
   import { basePlaywrightConfig } from '@jabraf/dev/playwright';

   export default basePlaywrightConfig();
   ```

   With options:

   ```ts
   export default basePlaywrightConfig({
     testDir: './e2e',
     isFunctional: process.env.TEST_ENV === 'functional',
     isCI: Boolean(process.env.CI),
     baseURL: 'https://example.com',
     devServerURL: 'http://localhost:3000',
   });
   ```

   Option summary (from the README):

   | Option         | Default                   | Notes                                     |
   | -------------- | ------------------------- | ----------------------------------------- |
   | `testDir`      | `'./integration'`         | Where tests live                          |
   | `isFunctional` | `false`                   | When `true`, starts dev/build server      |
   | `isCI`         | `false`                   | Forbids `.only`, 2 retries, 1 worker      |
   | `baseURL`      | `'http://localhost'`      | Used when `isFunctional` is `false`       |
   | `devServerURL` | `'http://localhost'`      | Used when `isFunctional` is `true`        |
   | `projects`     | Chromium (Desktop Chrome) | Override to add Firefox / WebKit / mobile |

   Ask which directory the user wants for tests (`e2e`, `tests/e2e`, `integration`) and use that for `testDir`. **[wait for user if ambiguous]**

7. **Install Playwright browsers.** Run `npx playwright install` (or `--with-deps` if on Linux/CI). Mention that this downloads ~hundreds of MB. **[wait for user]** Skip if browsers are already installed.

8. **Add scripts.** Add to `package.json` `scripts`, only if absent. The README's three-script pattern, gated on tags:

   ```jsonc
   {
     "scripts": {
       "test:functional": "TEST_ENV=functional playwright test --grep-invert @non-functional",
       "test:e2e": "playwright test --grep @e2e",
       "test:vr": "playwright test --grep @vr",
     },
   }
   ```

   Offer the simpler `"test:e2e": "playwright test"` if the user doesn't want tag-based separation. **[wait for user if conflict]**

9. **Validate.** Run `npx playwright test --list` (lists discovered tests without running them). Report:
   - 0 tests found → "Playwright is set up. Add a `*.spec.ts` under `<testDir>/` and re-run."
   - Tests listed → "Playwright is set up. N test(s) discovered."
   - Config error → surface and stop. Do not write example tests.

10. **Final report.** Summarize: project type, URLs, package manager, install status, config written, browsers installed, scripts added, validation outcome.

## Things you must NOT do

- Do not overwrite an existing Playwright config without explicit confirmation.
- Do not overwrite existing `package.json` scripts without confirmation.
- Do not pin `@jabraf/dev` (or `@playwright/test`) to a specific version — install at `latest`.
- Do not write example `*.spec.ts` files unless the user asks.
- Do not run the full test suite as part of setup — listing is enough.
- Do not enable mobile / WebKit / Firefox projects unless the user asks.
- Do not configure CI workflows (GitHub Actions, etc.) — out of scope.

## Edge cases

| Situation                                                      | Action                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                                  | Stop. Ask the user to initialise the project first.                                                              |
| Pure-Node lib with no browser surface                          | Stop per step 1. Suggest `jabraf-vitest` if they need unit tests instead.                                        |
| `playwright` already installed at a different major            | Surface the version. Ask whether to align with `@jabraf/dev`. **[wait for user]** Do not auto-upgrade.           |
| Existing test runner (Cypress, WebdriverIO)                    | Do not migrate. Ask the user to decide before proceeding.                                                        |
| User on Windows, asks to install browsers                      | `npx playwright install` works the same; skip `--with-deps` (Linux-only).                                        |
| User wants component testing (`@playwright/experimental-ct-*`) | Out of scope for the base factory. Tell the user to extend the config manually.                                  |
| Monorepo                                                       | Apply per-package. The factory is per-config-file; a workspace-level Playwright config is rare and out of scope. |

## Reference

- `@jabraf/dev` Playwright docs: [`packages/jabraf-dev/README.md#playwright`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#playwright)
- Subpath export: `@jabraf/dev/playwright` → `./dist/config/playwright/base-config.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
