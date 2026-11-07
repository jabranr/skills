---
name: jabraf-ground-rules
description: Jabran's ground rules for every project — how to work (clarify first, stay scoped, report real results) plus default stack (Cloudflare, Tailwind v4), TypeScript, testing, git/PR, gh, CI, security and docs conventions. Load at the start of any coding, repo, review, commit, PR or GitHub Actions task, and whenever a repo's AGENTS.md points to it or is silent on a convention.
---

# `jabraf-ground-rules`

The common baseline for every project and the single source of truth for it.
A repo's own `AGENTS.md` / `CLAUDE.md` / `.github/agents/*` / `docs/agents/*` is
more specific and **wins on conflict**; local machine rules (e.g.
`~/.agents/rules/`) add account- and host-specific detail. These rules fill
every gap they leave.

Section 1 applies to every task, chats included. Sections 2–10 apply when the
task touches a codebase.

## 1. How to work (every task)

- **Clarify first.** Before detailed work, ask the questions whose answers change
  what you build. Validate assumptions with the user or the code instead of
  guessing; state any assumption you do make, up front.
- **One-time asks.** Permission to commit, push, update an issue or PR, or read a
  restricted doc covers that one request only. Ask again next time.
- **Stay scoped.** Do exactly the task asked. Note follow-ups, refactors and
  unrelated bugs you spot as a separate list at the end.
- **Report real results.** Quote the actual outcome of every check you ran. If a
  step failed, was skipped or couldn't run, say which and why.
- **Ground every claim.** Flags, APIs, commands and behaviour come from the docs,
  source or `--help` output. When something is unclear, say so and ask.
- **Match the surroundings.** New code reads like the code next to it: structure,
  naming, comment density. Comments explain _why_.

## 2. Orient in the repo (first coding step)

Read the environment before writing code; it is the source of truth.

1. Repo agent docs: `AGENTS.md`, `CLAUDE.md`, then the guide relevant to the task.
2. `package.json` scripts, lockfile (`package-lock.json` → npm, `pnpm-lock.yaml`
   → pnpm), Node pin (`.node-version`, `engines.node`; legacy `volta` key or
   `.nvmrc`), `mise.toml`, default branch.
3. Existing configs: `eslint.config.*`, `.prettierrc*`, `tsconfig*.json`,
   `vitest.config.*`, `playwright.config.*`, `.github/workflows/`.

Done when you can name the repo's gate commands, package manager, Node version
and default branch.

### Tool managers: mise, then Volta

`mise` is the preferred tool manager; Volta is legacy. Pick the runner for
Node-based commands in this order:

1. **mise** — when `mise` is on `PATH` (`command -v mise`), run commands through
   it: `mise exec -- npm test`. This applies even when the repo also has a
   `volta` key.
2. **Volta** — otherwise, when `package.json` has a `volta` key **and** `volta`
   is on `PATH`, use `volta run npm test`.
3. **Neither** — run commands directly: `npm test`.

Repos still on Volta (a `volta` key and no `.node-version`) get
"migrate Volta → mise" in your follow-ups list; leave the migration itself for
an explicit ask.

Runners are an execution detail only: write plain commands (`npm test`) in every
instruction, doc, README, AGENTS.md, PR and commit message you produce, with no
`mise exec` or `volta run` prefix.

### Node version: `.node-version` + `engines.node`

- **`.node-version`** holds the exact Node pin (e.g. `24.11.1`). It is the one
  source of truth for the version, read by mise, CI and other managers.
- **`package.json` `engines.node`** states the supported minimum as a range from
  that pin (e.g. `">=24.11.1"`).
- **`mise.toml`** carries no `node` entry; mise reads `.node-version` as an
  idiomatic version file. That reading is off by default since mise 2025.10, so
  it needs `idiomatic_version_file_enable_tools = ["node"]` (global, or under
  `[settings]` in the repo's `mise.toml`). Check with `mise exec -- node -v`: if
  it doesn't match `.node-version`, report the mismatch rather than changing the
  user's global mise config.
- **Keep them in sync.** A Node bump updates `.node-version`, `engines.node` and
  any CI `node-version` input together, in one change.
- **Gaps are follow-ups.** A repo missing `.node-version` or `engines.node`, or
  where they disagree, gets a follow-up entry; add or fix them only when asked.

## 3. Code conventions (TypeScript / Node / React)

- **Strict TypeScript.** Type precisely; reach for `unknown` plus narrowing when a
  type is genuinely open. Fix type errors at the source rather than with `any`,
  `as` casts or `@ts-ignore`; if one is truly unavoidable, leave a one-line reason.
- `import type { … }` for type-only imports. ESM throughout.
- `interface` for object shapes, `type` for unions and aliases.
- **Named exports**, except where a framework requires a default
  (route modules, config files, the top-level `App`).
- **Naming:** kebab-case for every file and folder (`person-node.tsx` exports
  `PersonNode`; hooks are `useThing` in `use-thing.ts`). PascalCase types and
  components, camelCase values.
- **Comments:** `/** … */` for every multi-line comment block; `//` for a single
  line only.

  ```ts
  /**
   * Cut at the last separator that fits so words stay whole.
   */
  // single-line note
  ```

- **Tooling:** lint, format and TS configs come from `@jabraf/dev`; use them as
  configured. To add or set them up, use the `jabraf-dev-setup` skill (or the
  granular `jabraf-*` skills).
- **Dependencies:** prefer the standard library and existing helpers. A new
  runtime dependency needs a one-line justification in the PR. Install with the
  package manager CLI (`npm install <pkg> [-w <workspace>]`) so the lockfile stays
  consistent; leave dependency lists in `package.json` to the tool.
- **Config-driven:** environment values via `@jabraf/app-config` `getConfig()`.
  Ship every new user-facing feature behind a flag: on in dev, **off** in
  production until intentionally launched.
- **Shared, single source:** types and validation schemas (e.g. Zod) live once in a
  shared module and are imported by client, server and DB.

### Platform: Cloudflare for new projects

New projects default to the Cloudflare stack, Workers first. Existing
projects keep their platform; suggest a move only as a follow-up.

- **Hosting and APIs:** Workers, with static assets for sites and SPAs. Keep
  Pages only where a project already uses it.
- **Data and state:** D1 (SQL), KV (config, cache), R2 (files), Queues
  (background work), Durable Objects (coordination, realtime), picked to fit.
- **Config and deploy:** `wrangler` with a committed `wrangler.jsonc`; types
  from `wrangler types`; local dev via `wrangler dev`.
- When a requirement doesn't fit Cloudflare (e.g. a long-running process or a
  runtime it lacks), say so and ask before picking another platform.

### UI

- **Styling: Tailwind CSS v4**, CSS-first: `@import "tailwindcss";` in the main
  stylesheet, tokens in `@theme`, custom utilities via `@utility`, and no
  `tailwind.config.js`. Wire it with `@tailwindcss/vite` (Vite projects) or
  `@tailwindcss/postcss`. Repos on Tailwind v3 get "migrate Tailwind v3 → v4"
  in your follow-ups list; leave the migration itself for an explicit ask.
- Design tokens and shared primitives for colour, spacing and type; light and
  dark both work.
- Accessible to WCAG 2.2 AA: labelled controls, visible focus, keyboard reachable,
  meaning carried by more than colour.
- Motion respects `prefers-reduced-motion`. Content pages work without JavaScript;
  JS enhances.

## 4. Testing

- **TDD: red → green → refactor.** Write the test that fails for the right reason,
  make the smallest change that turns it green, then refactor with it green. A bug
  fix starts with a test that reproduces the bug.
- **Vitest** for unit/component tests (over Jest, including when setting a suite
  up); **Playwright** for browser flows.
- **Meaningful assertions only.** Each test asserts real behaviour of the code
  under test, the kind of test that would catch a regression. Constants,
  re-exports and tests written just to turn the suite green add nothing; leave
  them out.
- Mock with `vi.mock` / `vi.mocked` / `vi.stubGlobal`; reach for `vi.doMock` only
  when hoisted mocking genuinely can't express the case.
- Every code path you add is exercised by a test.
- **Keep every suite current.** In the same change, update each test the change
  affects and add coverage in every suite it touches (unit, API, functional,
  smoke). Cover feature flags both on and off, plus side effects (rows written,
  events, emails).
- **File naming for new tests:** Vitest unit/component → `*.test.ts(x)`;
  Playwright functional/e2e → `*.spec.ts`. Test files sit beside their source and
  mirror its name.

## 5. The gate (before calling anything done)

Run the repo's equivalents of, and report each result:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

Add functional/e2e suites when UI or API flows changed, and any repo-specific
checks (migrations, VR snapshots) its agent docs list. Run them through the
tool manager chosen in section 2.

## 6. Git and pull requests

- **Branch** off the default branch: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
  All commits land on the feature branch.
- **Agent autonomy:** you may commit to a feature branch. Pushing, opening,
  updating or merging PRs and issues, tagging, rebasing shared branches and
  force-pushing each wait for the user's explicit, one-time ask.
- **Conventional Commits:** `type(scope): subject` with types `feat`, `fix`,
  `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Imperative
  subject under ~72 chars; the _why_ goes in the body; breaking changes use `!` or
  a `BREAKING CHANGE:` footer. Versioning tools parse these, so the format is
  load-bearing.
- Let the hooks run on every commit (Husky, lint-staged, commitlint); fix what
  they flag.
- **One concern per PR.** PR body covers: what changed, why, how it was tested
  (actual gate output), anything intentionally left out, `Fixes #NN`, and
  screenshots for UI changes. Use the repo's PR template when it has one.
- **Updating an existing PR summary:** keep it short, keep its existing structure
  and information, and fit it to the PR template where available.

### gh and GitHub

- Use the `gh` CLI for GitHub repos, issues, PRs and links in the user's own
  repos, rather than fetching the web page.
- Use `github.com` / `api.github.com` for every `gh` and API call, even when a
  git remote uses an SSH host alias.

### Worktrees

- Create worktrees inside the repo under `.worktrees/`, then run the install
  (`npm i`) in the new worktree.
- Commit work in the worktree; leave pushing to the user and end with a short
  list of the commands to push it.

## 7. CI (GitHub Actions)

- Reuse the `jabranr/workflows` reusable workflows where one fits; the
  `jabraf-workflows-*` skills set them up.
- **Pin every action to a full commit SHA with the version as a comment:**
  `uses: actions/checkout@<40-char-sha> # v4.2.2`. Resolve the SHA from the
  action's tagged release rather than writing one from memory.
- `actions/setup-node` reads the version from the repo:
  `node-version-file: .node-version`.
- `fetch-depth: 0` on checkouts that run conventional-commit or versioning tools.
- `HUSKY: 0` on steps that run `npm version` / `lerna version`.
- Version tags are created by the publish workflow only.
- **Validate, run and inventory workflows with
  [`@secureci/cli`](https://github.com/secure-ci/cli)** (`secureci`, via
  `npx @secureci/cli` when not installed). Set it up with the
  [`secureci`](https://github.com/secure-ci/cli/tree/main/skills/secureci) skill
  (`npx skills add secure-ci/cli --skill secureci`):
  - `secureci validate .github/workflows/*.yml` — syntax, template injection,
    token permissions, risky triggers; keep workflows passing it.
  - `secureci run <workflow> --dry-run` (or a real local run) to try a workflow
    before pushing.
  - `secureci inventory` to lock actions in a committed `secureci.lock`;
    `secureci inventory --check` in CI to fail on tag drift.
  - `secureci pin` to rewrite action tags to commit SHAs (keeps the `# vX`
    comment).
- **Don't use `actionlint`.** Use `secureci validate`. Repos still running
  `actionlint` (incl. the `jabranr/workflows` actionlint action) get "replace
  actionlint with `secureci`" in your follow-ups list; swap it only when asked.

## 8. Security

- Keep secrets, `.env*`, generated artifacts and local state out of commits; check
  `git status` before committing.
- Logs carry no secrets, tokens or raw client IPs.
- Fail closed: when a check, key or config is missing, deny rather than allow.
- Preserve existing security and anti-abuse layers (rate limits, bot checks,
  origin gating, container isolation, secret masking). Any change near them gets a
  test that locks the behaviour down, and a call-out in the PR.

## 9. Plans and working docs (`ai-docs/`)

- When asked to save a plan or working doc, write it to `ai-docs/` in the current
  repo unless the user names another location.
- Read `ai-docs/` only when the user asks, and only for that request.
- Files prefixed `[done]-` are finished; read them only when explicitly asked.
- When a plan from `ai-docs/` is fully implemented, rename it with the `[done]-`
  prefix.
- Keep `ai-docs/` out of everything else: commits, PRs, issues and files outside
  that folder. Where a reference is unavoidable, use a relative path.

## 10. Project docs

- Update docs in the same change as the behaviour: user-facing → `README.md` /
  `DOCS.md`; internal design, tooling or workflow → `AGENTS.md` and its linked
  guides.
- Agent-docs layout for any repo: `AGENTS.md` is canonical and opens with the
  pointer to this skill (below); `CLAUDE.md` is a thin `@AGENTS.md` import;
  `.github/copilot-instructions.md` is a short pointer; depth lives in
  `.github/agents/*.md` or `docs/agents/*.md`, one topic per file. Each repo doc
  records only what is specific to that repo, and links here for the rest.

### Pointer block for a repo's `AGENTS.md`

```md
## Baseline rules

Follow the [`jabraf-ground-rules`](https://github.com/jabranr/skills/blob/main/skills/jabraf-ground-rules/SKILL.md)
skill (install: `npx skills add jabranr/skills -g --skill jabraf-ground-rules`).
This file lists only what is specific to this repo and wins where the two differ.
```

## Definition of done

- [ ] Scope matches the ask; follow-ups listed separately.
- [ ] New behaviour has a meaningful test that was red before and green now; no stale tests.
- [ ] Gate run, each result reported as observed.
- [ ] No secrets, generated files, local state or `ai-docs/` references staged.
- [ ] Docs updated where behaviour, commands or setup changed.
- [ ] Committed on a feature branch; nothing pushed unless asked.
