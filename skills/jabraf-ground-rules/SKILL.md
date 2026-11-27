---
name: jabraf-ground-rules
description: Jabran's ground rules for every project — how to work (clarify first, stay scoped, report real results), terse humanized responses, plus default stack (Cloudflare, Tailwind v4), TypeScript, testing, git/PR, gh, CI, security and docs conventions, and the cloud-session rules (git identity, main + subagents mode only when asked, model choices). Load at the start of any coding, repo, review, commit, PR or GitHub Actions task, and whenever a repo's AGENTS.md points to it or is silent on a convention.
---

# `jabraf-ground-rules`

The common baseline for every project and the single source of truth for it.
A repo's own `AGENTS.md` / `CLAUDE.md` / `.github/agents/*` / `docs/agents/*` is
more specific and **wins on conflict**; local machine rules (e.g.
`~/.agents/rules/`) add account- and host-specific detail. These rules fill
every gap they leave.

Section 1 applies to every task, chats included. Sections 2–10 apply when the
task touches a codebase. Section 11 applies in cloud sessions.

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

### Responses (always)

Applies to every reply, chats included.

- **Concise.** Be extremely concise, to the point and accurate with facts.
  Sacrifice grammar for the sake of concision.
- **Humanize.** Then apply the `humanizer` skill
  ([blader/humanizer](https://github.com/blader/humanizer)) to the reply. Load it
  once per session; if it is not installed, load it through `jabraf-skills-index`.
  Humanizer must not undo the concision above, and must not change facts.

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
  production until intentionally launched. In React apps, mount
  `FeatureFlagsPanel` once at the root so flags can be toggled in-app (any env,
  incl. mobile) via `?ffs=1`.
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

### Driving a browser

- To open, click through, snapshot or screenshot a page by hand (checking a UI
  change, reproducing a bug, exploring a flow), use `playwright-cli` rather
  than a Playwright MCP server. It saves snapshots to files instead of
  returning them on every step, so it costs far fewer tokens. Load the
  `playwright-cli` skill for its commands.
- Run it as `playwright-cli`. When that command is missing, use
  `npx playwright cli` if the repo has Playwright 1.59 or newer, and otherwise
  ask before installing `@playwright/cli` globally.
- Behaviour you verify this way that should stay working goes into a
  Playwright test, per the rules above.

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
  Cloud sessions push their feature branch without asking (section 11).
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
  repos, rather than fetching the web page or calling a GitHub MCP server. The
  `gh` skill covers structured output, pagination, search and `gh api`. Cloud
  sessions without `gh` use the platform's GitHub tools (section 11).
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

## 11. Cloud sessions

Applies when the session runs in a remote, ephemeral agent container. Treat the
session as a cloud session when either variable is set:

- `AGENT_CLOUD_SESSION=1`, set by the environment's setup script (any agent).
- `CLAUDE_CODE_REMOTE=true`, set by Claude Code on the web.

Local sessions skip this section.

### Git identity

Check these four variables before the first commit. Set each one that is unset
or empty to the value below, and leave any that already has a value as it is.

```bash
export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-Jabran Rafique}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-2131246+jabranr@users.noreply.github.com}"
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-Jabran Rafique}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-2131246+jabranr@users.noreply.github.com}"
```

Shell state often does not carry from one command to the next, so make the
values reach every `git commit`: persist them where the session's shell loads
them, or run the exports in the same command as the commit. Leave
`git config user.*` alone.

### Git and GitHub in the cloud

The container is discarded when the session ends, so unpushed work is lost.
These two points replace their section 6 counterparts in a cloud session:

- **Push without asking.** Push the session's feature branch after each commit
  or batch of commits. Everything else in section 6 still waits for the user's
  explicit ask: opening, updating or merging PRs and issues, tagging, rebasing
  shared branches, force-pushing, and pushing to any other branch.
- **GitHub access.** Use `gh` when it is installed. When it is not, use the
  GitHub tools the platform provides.

### Models

The setup script may set these variables. Use the value when one is set and the
default when it is not.

| Variable                        | Role                              | Default             |
| ------------------------------- | --------------------------------- | ------------------- |
| `AGENT_MAIN_MODEL`              | Main agent (no fallback)          | `claude-opus-5-5`   |
| `AGENT_SUBAGENT_MODEL`          | Every subagent                    | `claude-sonnet-5-5` |
| `AGENT_SUBAGENT_FALLBACK_MODEL` | Subagents, when the first is down | `claude-haiku-5-5`  |

- **Main agent.** The harness picks the main model before these rules load, so
  `AGENT_MAIN_MODEL` only records what the setup script intended; the setup
  script is what applies it, by mapping it onto the harness's own model
  setting. Check which model is serving the session where the harness lets
  you. If it is not the main model, say so in your first reply and carry on.
- **Subagents.** Applies only in main + subagents mode. Pass the subagent
  model explicitly on every spawn. When a spawn
  fails because that model is unavailable, retry once with the fallback and
  tell the user at that point, naming the task and the model, rather than
  leaving it for the final summary.

### Default: work as a single agent

By default a cloud session works like a local one: follow sections 1 to 10 and
do the work yourself, with the git rules above. Do not spawn subagents or switch
to main + subagents mode on your own judgement.

### Main + subagents mode (only when asked)

Use this mode only when the user explicitly asks for it in the session, e.g.
"use subagents", "plan and delegate" or "main + subagents". The ask covers the
rest of the session unless the user says otherwise. In this mode the main agent
plans and coordinates, and subagents implement.

**The one exception: a small ask that needs no questions.** Do the work yourself
only when both hold:

- you have no follow-up questions for the user, and
- the whole change is under 50 changed lines (added plus removed).

Open your reply by saying you are doing it yourself, with any assumptions you
are making, so the user can stop you. Then implement, run the gate, commit,
push and report. The exception ends the moment a question for the user comes up
or the change grows past 50 lines: stop implementing, say so, and take the ask
through the steps below.

For every other ask:

1. **Plan by interview.** Read the code and ask follow-up questions until the
   plan is comprehensive: goal, scope, files, approach, tests, gate commands,
   and what is left out. Reading, searching and running read-only commands are
   yours to do; editing files, running generators or installs, and committing
   are not.
2. **Wait for the go-ahead.** Stay in planning until the user directs you to
   implement. Approving one plan covers that plan only.
3. **Hand over.** Split the plan into tasks and give each to a subagent with a
   brief (see "The brief" below). Tasks that run in parallel touch disjoint
   files; tasks that share a file or depend on each other run in order.
4. **Wait and guide.** Wait for every subagent to report. When one reports an
   error or asks a question, answer with your best judgement whenever the plan,
   the code or these rules settle it, and send the fix back to a subagent. Ask
   the user when the answer would change scope, is a decision the plan left
   open, or needs an approval that section 6 reserves for them. Also go to the
   user, with what was tried, when a task has failed twice or a subagent has
   stopped responding and its replacement fails too.
5. **Verify the whole.** Tasks that each pass can still break together. Once
   all work has landed, run the full gate (section 5) once on the combined
   result, yourself or through one final subagent. Send any failure back to a
   subagent as a new task.
6. **Push and summarise.** Push the branch, then reply with a short summary:
   what changed, the final gate results as observed, any fallback model used,
   and follow-ups.

### The brief

A subagent starts with none of the conversation, so the brief is all it knows.
Write it to stand alone, and leave the conversation itself out. Every brief
has, in this order:

1. **Role.** Open with: "You are a subagent. Implement this task. Do not plan
   with the user, and do not spawn subagents." A subagent that loads this skill
   reads this section too, and this line is how it knows which role it has.
2. **Goal.** What this task achieves and why, in a sentence or two.
3. **Exact files.** The paths to change or create, and the paths to read for
   context. Name anything it must leave untouched.
4. **Decisions made.** What the interview settled that the code does not show:
   choices the user made, options that were rejected and why, and anything
   deliberately left out of scope.
5. **Constraints.** The limits for this task: which rules of this skill
   matter most here, the gate commands to run, and files other subagents own.
6. **Done.** What finished looks like and what to report back: files changed,
   the gate output as observed, the commit hash, and any open question.

When the plan is too large or too interlinked for briefs to carry without
losing decisions, save it to a file in `ai-docs/` (section 9) and point each
brief at that file, keeping the role, the task's own files and its done
criteria in the brief. This is the one case where a plan is written to and read
from `ai-docs/` without the user asking.

### Subagents

- Follow sections 1 to 10 and the brief. Put a question the brief does not
  answer to the main agent rather than guessing.
- Commit your own task on the feature branch, staging only the files the brief
  gave you, by path. When another subagent's commit holds the git lock, wait
  and retry. Leave pushing to the main agent.

## Definition of done

- [ ] Scope matches the ask; follow-ups listed separately.
- [ ] New behaviour has a meaningful test that was red before and green now; no stale tests.
- [ ] Gate run, each result reported as observed.
- [ ] No secrets, generated files, local state or `ai-docs/` references staged.
- [ ] Docs updated where behaviour, commands or setup changed.
- [ ] Committed on a feature branch; nothing pushed unless asked (cloud sessions: branch pushed).
- [ ] In a cloud session in main + subagents mode (only when asked): work delegated unless it met the small-ask exception, full gate run on the combined result, summary given.
