---
name: jabraf-vitest
description: Set up Vitest in a project using `@jabraf/dev`'s `baseVitestConfig` factory. Load when the user asks to add Vitest, set up unit tests, configure `vitest.config.ts`, or wire up `@jabraf/dev` Vitest specifically. Do not load for Jest, Mocha, or general testing questions unrelated to `@jabraf/dev`.
---

# `jabraf-vitest`

Adds Vitest to the current project via the `baseVitestConfig` factory from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). The factory takes
`{ react?: boolean, coverage?: boolean, reporters?: string[] }`; enable
`react: true` to load the React Testing Library setup.

Canonical setup lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#vitest).

## When to load this skill

Load when the user's prompt mentions any of:

- "Vitest", "unit tests", "`vitest.config`"
- "React Testing Library" + "Vitest"
- "`@jabraf/dev` vitest", "jabraf vitest"

Do not load for Jest, Mocha, Tap, or general "write tests" requests that don't
involve Vitest. Do not load alongside `jabraf-dev-setup` — the umbrella will
invoke this one.

## Conversation flow

1. **Brief acknowledge + project-shape detection.** Detect:
   - `react` / `react-dom` in deps → default `react: true`
   - Otherwise → default `react: false`
   - Look for an existing `coverage/` folder or a `coverage` npm script → propose `coverage: true`

   One sentence: "I'll add Vitest via `@jabraf/dev`. Detected `<react|no react>` → `baseVitestConfig({ react: <bool> })`. Proceed?" **[wait for user]**

2. **Detect package manager.** Standard logic.

3. **Detect existing config.** Check for `vitest.config.{js,ts,mjs,mts,cjs,cts}` and any `vitest` block in `package.json`. If found, show contents and ask: "Replace with the `@jabraf/dev` factory call, leave alone, or merge?" **[wait for user]** Never overwrite silently.

4. **Install `@jabraf/dev` if missing.** Dev dep, at `latest`.

5. **Write `vitest.config.ts`.** Default body — adjust the options object based on detection:

   ```ts
   import { baseVitestConfig } from '@jabraf/dev/vitest';

   export default baseVitestConfig();
   ```

   With options:

   ```ts
   import { baseVitestConfig } from '@jabraf/dev/vitest';

   export default baseVitestConfig({ react: true, coverage: true });
   ```

   Available options (from the README):

   | Option      | Type       | Default       | Description                               |
   | ----------- | ---------- | ------------- | ----------------------------------------- |
   | `react`     | `boolean`  | `false`       | Adds the React Testing Library setup file |
   | `coverage`  | `boolean`  | `false`       | Enables V8 coverage provider              |
   | `reporters` | `string[]` | `['default']` | Vitest reporter list                      |

6. **Add scripts.** Add to `package.json` `scripts`, only if absent:

   ```jsonc
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
     },
   }
   ```

   If the project also uses `jabraf-tsconfig`, propose composing typecheck into `test` (`tsc --noEmit && vitest run`) — but only if a `typecheck` script already exists. **[wait for user if conflict]**

7. **Validate.** Run `<pm> run test` (or `npx vitest run`). Report:
   - 0 tests found → "Vitest is set up. Add a `*.test.ts` (or `*.spec.ts`) and re-run."
   - Tests pass → "Vitest is set up. N test(s) passing."
   - Tests fail → surface the failures and stop; do not edit test files.

8. **Final report.** Summarize: package manager, detected React/coverage flags, install status, config written, scripts added, validation outcome.

## Things you must NOT do

- Do not overwrite an existing Vitest config without explicit confirmation.
- Do not overwrite existing `package.json` scripts without confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not write example test files unless the user asks.
- Do not edit project source files. Only `vitest.config.ts` and `package.json` `scripts`.
- Do not install `@testing-library/*` packages directly — they come transitively via `@jabraf/dev`.

## Edge cases

| Situation                                               | Action                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project has no `package.json`                           | Stop. Ask the user to initialise the project first.                                                                                                    |
| Vitest 1.x already installed at a pinned older version  | Note that `@jabraf/dev`'s factory targets Vitest 4+. Ask whether to upgrade. **[wait for user]** Do not auto-upgrade.                                  |
| Project uses Jest                                       | Do not migrate. Ask the user to decide before proceeding. Migration is out of scope.                                                                   |
| Monorepo with `vitest.workspace.ts`                     | Leave the workspace file alone. Apply this skill per-package. If the user wants a workspace-level config too, ask explicitly. **[wait for user]**      |
| `react: true` requested but no `react` in deps          | Block. The factory's React setup imports `@testing-library/react`; without `react`/`react-dom`, tests will fail. Tell the user to install React first. |
| Browser-mode Vitest                                     | Out of scope for the base factory. If the user asks for browser mode, tell them to extend the config manually.                                         |
| Coverage flag set but no `@vitest/coverage-v8` resolved | The factory pulls coverage via Vitest 4's built-in provider; if a resolution error appears, surface it and stop.                                       |

## Reference

- `@jabraf/dev` Vitest docs: [`packages/jabraf-dev/README.md#vitest`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#vitest)
- Subpath exports: `@jabraf/dev/vitest` (factory), `@jabraf/dev/vitest/react-setup` (setup file used internally when `react: true`) — see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map
