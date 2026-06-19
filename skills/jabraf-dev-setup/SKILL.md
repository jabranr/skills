---
name: jabraf-dev-setup
description: Orchestrate a full `@jabraf/dev` setup in a project by invoking the granular `jabraf-*` skills in order — TSConfig, Prettier, ESLint, Vitest, Playwright (when relevant), commitlint, lint-staged. Load when the user asks for the full `@jabraf/dev` stack, a greenfield setup, or "everything from `@jabraf/dev`". Requires the granular skills to be installed alongside this one.
---

# `jabraf-dev-setup`

Umbrella skill. Does **not** duplicate the work of the seven granular
`jabraf-*` skills — it sequences them and confirms the user's choices once
up front instead of per-skill. The granular `SKILL.md` files are the source
of truth; this skill just orchestrates.

## Precondition: granular skills must be installed

This skill assumes the following sibling skills are installed in the same agent:

- `jabraf-tsconfig`
- `jabraf-prettier`
- `jabraf-eslint`
- `jabraf-vitest`
- `jabraf-playwright`
- `jabraf-commitlint`
- `jabraf-lint-staged`

If any are missing, stop on step 1 and tell the user:

> The `jabraf-dev-setup` umbrella delegates to the granular `jabraf-*` skills. Install them alongside this one:
>
> ```bash
> npx skills add jabranr/skills -g -a <agent> --skill '*' -y
> ```

## When to load this skill

Load when the user's prompt mentions any of:

- "set up `@jabraf/dev`" / "the full `@jabraf/dev` stack"
- "greenfield setup", "scaffold dev tooling"
- "all the jabraf tooling", "jabraf dev setup"

Do not load when the user names a specific tool (Prettier, ESLint, Vitest,
etc.) — the matching granular skill should load instead. Do not load alongside
any granular `jabraf-*` skill in the same task — pick one or the other.

## Conversation flow

1. **Precondition check.** Verify the seven granular skills above are present. If any are missing, stop with the message above and exit. **[wait for user if missing]**

2. **Brief acknowledge + project-shape probe.** Read the target project's `package.json` once and detect signals that drive defaults across the granular skills:
   - Package manager (lockfile)
   - TSConfig preset (`react`/`next`/`vite` → `app`; `react` only → `lib`; `bin` or none → `node`; fallback → `base`)
   - Vitest `react: true` if React is present
   - Playwright applicable? (any web framework / browser surface)
   - `package.json` `type` field for the commitlint config extension

   Present a single consolidated plan, one message:

   > I'll run the full `@jabraf/dev` setup in this order:
   >
   > 1. `jabraf-tsconfig` (preset: `<detected>`)
   > 2. `jabraf-prettier`
   > 3. `jabraf-eslint`
   > 4. `jabraf-vitest` (react: `<detected>`)
   > 5. `jabraf-playwright` (<applicable | skipping — pure-Node lib>)
   > 6. `jabraf-commitlint` (config extension: `<.js | .mjs>`)
   > 7. `jabraf-lint-staged`
   >
   > Package manager: `<detected>`. Each step asks before overwriting. Proceed?

   **[wait for user]**

3. **Run each granular skill in order.** For each, follow its `SKILL.md` flow verbatim — do not inline the steps here. Carry forward the detected defaults from step 2 so the user is not asked the same question twice.

   - **Step 3.1** — `jabraf-tsconfig` with the detected preset.
   - **Step 3.2** — `jabraf-prettier`.
   - **Step 3.3** — `jabraf-eslint`. Default `eslint.config.ts` (TypeScript is now present from step 3.1).
   - **Step 3.4** — `jabraf-vitest` with the detected `react` flag.
   - **Step 3.5** — `jabraf-playwright`, only if applicable. Skip cleanly otherwise; do not prompt.
   - **Step 3.6** — `jabraf-commitlint`. Surface the hook-manager choice once (carry to step 3.7).
   - **Step 3.7** — `jabraf-lint-staged`. Reuse the hook manager picked in 3.6 (do not ask again).

   Between steps, post a one-line progress marker: "✓ `<skill>` done." On any granular skill returning `conflict` or stopping for input, the umbrella stops too and surfaces the situation. **[wait for user on conflict]**

4. **Consolidated validation.** After all granular skills have run:
   - Run `<pm> run typecheck` (if added)
   - Run `<pm> run lint`
   - Run `<pm> run format`
   - Run `<pm> run test`
   - Run `npx playwright test --list` (if Playwright was installed)

   Surface the matrix. Do not auto-fix. Do not commit.

5. **Final report.** One consolidated summary covering every granular skill's output: package manager, TSConfig preset, install status of `@jabraf/dev`, config files written, scripts added, hook manager wired, validation matrix.

## Things you must NOT do

- Do not duplicate the granular skills' logic inline — invoke them.
- Do not skip the precondition check on step 1. The umbrella is useless without the granular skills.
- Do not run any granular skill twice within the same session.
- Do not silently skip a granular skill that returned `conflict` — surface and wait.
- Do not commit, push, or open PRs at any step.
- Do not configure CI workflows — out of scope.

## Edge cases

| Situation                                                          | Action                                                                                                                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One or more granular skills missing                                | Stop on step 1. Show the install command. Do not partially proceed.                                                                                                         |
| Pure-Node library                                                  | Skip `jabraf-playwright` in step 3.5 with a one-line marker. Continue.                                                                                                      |
| User declines a step mid-flow                                      | Skip that step, mark it as `skipped` in the final report, continue with the rest.                                                                                           |
| User picks "leave alone" on an existing config in a granular skill | The granular skill records `kept-existing`. The umbrella forwards that status to the final report and continues.                                                            |
| Monorepo (`workspaces` present)                                    | Ask once on step 2: "Apply to the repo root, a specific workspace, or all workspaces?" **[wait for user]** Re-run the full sequence per chosen location. Do not interleave. |
| User wants a subset (e.g. only Prettier + ESLint)                  | Stop. Tell them to use the granular skill(s) directly. The umbrella does not support partial sequencing.                                                                    |
| Granular skill not yet released for one of the tools               | Skip that step and surface in the final report. Do not block on it.                                                                                                         |

## Reference

- Granular skills (one folder each in this repo):
  - [`skills/jabraf-tsconfig`](../jabraf-tsconfig/SKILL.md)
  - [`skills/jabraf-prettier`](../jabraf-prettier/SKILL.md)
  - [`skills/jabraf-eslint`](../jabraf-eslint/SKILL.md)
  - [`skills/jabraf-vitest`](../jabraf-vitest/SKILL.md)
  - [`skills/jabraf-playwright`](../jabraf-playwright/SKILL.md)
  - [`skills/jabraf-commitlint`](../jabraf-commitlint/SKILL.md)
  - [`skills/jabraf-lint-staged`](../jabraf-lint-staged/SKILL.md)
- `@jabraf/dev` umbrella README: [`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md)
- Install all skills together: `npx skills add jabranr/skills -g -a <agent> --skill '*' -y`
