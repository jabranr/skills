# @jabranr/skills

Custom agent skills for adopting Jabran's tooling —
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev),
[`@jabraf/app-config`](https://www.npmjs.com/package/@jabraf/app-config),
and the [`jabranr/workflows`](https://github.com/jabranr/workflows) reusable
CI workflows — in any target project.

Skills follow the open [Agent Skills specification](https://agentskills.io)
([skills.md](https://skills.md)) — plain `SKILL.md` files with YAML frontmatter
under `skills/<name>/`. They are installed with the
[`skills` CLI](https://github.com/vercel-labs/skills) and work with any
supported agent (Claude Code, Codex, Cursor, OpenCode, and others).

## Layout

```
skills/
  # Baseline for every project
  jabraf-ground-rules/SKILL.md         # common rules; repos point to it from AGENTS.md
  jabraf-skills-index/SKILL.md         # router to every skill in the library (generated catalog)

  # @jabraf/dev tooling
  jabraf-prettier/SKILL.md
  jabraf-eslint/SKILL.md
  jabraf-oxlint/SKILL.md
  jabraf-tsconfig/SKILL.md
  jabraf-vitest/SKILL.md
  jabraf-playwright/SKILL.md
  jabraf-commitlint/SKILL.md
  jabraf-lint-staged/SKILL.md
  jabraf-dev-setup/SKILL.md            # umbrella, orchestrates the granular skills

  # @jabraf/app-config
  jabraf-app-config-setup/SKILL.md     # standalone, @jabraf/app-config setup

  # jabranr/workflows
  jabraf-workflows-pr-checks/SKILL.md
  jabraf-workflows-npm-publish/SKILL.md
  jabraf-workflows-integration/SKILL.md
  jabraf-workflows-wait-cf-pages/SKILL.md
  jabraf-workflows-performance-audit/SKILL.md
```

## Using `jabraf-ground-rules` in a project

`jabraf-ground-rules` is the single source of truth for the rules shared by every
project. Install it globally, then open each repo's `AGENTS.md` with:

```md
## Baseline rules

Follow the [`jabraf-ground-rules`](https://github.com/jabranr/skills/blob/main/skills/jabraf-ground-rules/SKILL.md)
skill (install: `npx skills add jabranr/skills -g --skill jabraf-ground-rules`).
This file lists only what is specific to this repo and wins where the two differ.
```

Keep repo docs to what is specific to that repo; change shared rules here.

### Cloud sessions

Section 11 of `jabraf-ground-rules` covers agent cloud sessions (e.g. Claude Code
on the web): git identity, pushing so work is not lost, a main agent that plans
and delegates implementation to subagents, and model choices. A cloud
environment's setup script can fetch the file as base instructions:

```
https://raw.githubusercontent.com/jabranr/skills/<ref>/skills/jabraf-ground-rules/SKILL.md
```

Replace `<ref>` with a commit SHA or tag rather than `main`, so a push to `main`
does not change the instructions of every later session until you move the pin.

Variables the setup script can set:

| Variable                        | Purpose                                        | Default            |
| ------------------------------- | ---------------------------------------------- | ------------------ |
| `AGENT_CLOUD_SESSION`           | `1` marks the session as a cloud session       | unset              |
| `AGENT_MAIN_MODEL`              | Main agent model                               | `claude-fable-5-2` |
| `AGENT_MAIN_FALLBACK_MODEL`     | Main agent model when the first is unavailable | `claude-opus-5-5`  |
| `AGENT_SUBAGENT_MODEL`          | Subagent model                                 | `claude-opus-5-5`  |
| `AGENT_SUBAGENT_FALLBACK_MODEL` | Subagent model when the first is unavailable   | `claude-haiku-5-5` |

The skill can only choose subagent models. The two `AGENT_MAIN_*` variables take
effect only when the setup script also maps them onto the agent harness's own
model setting. Claude Code on the web is detected through `CLAUDE_CODE_REMOTE`
and does not need `AGENT_CLOUD_SESSION`.

## One skill for the whole library

`jabraf-skills-index` is a router. Install it instead of the whole library and
it points the agent at the right skill for each task. A skill that is not
installed is loaded on demand with `npx skills use <target>`, which fetches the
skill and its supporting files into a temp directory without installing
anything.

```bash
npx skills add jabranr/skills -g -a <agent> --skill jabraf-skills-index -y
```

The catalog covers:

- this repo's skills
- every third-party skill in the local `skills` CLI lock file
  (`~/.agents/.skill-lock.json`)
- the skills inside Claude Code plugins: ones installed from a marketplace
  (read from `~/.claude/plugins`), plus the ones listed by hand under
  `plugins` in `scripts/skills-index/catalog.json`. Plugins synced from a
  claude.ai account do not record their GitHub repo locally, so they go in that
  list.

Groups and the "when to use" lines are curated in
`scripts/skills-index/catalog.json`. The sync shallow-clones each source repo,
so skill paths and default branches come from the repo itself, and a skill that
moved upstream is picked up at its new path. It then renders two files from the
catalog: the catalog block in `SKILL.md` and `.claude-plugin/marketplace.json`.

```bash
npm run skills:index              # pick up new or removed skills and plugins, then re-render
npm run skills:index -- --prune   # also drop entries that were not discovered
npm run skills:index:check        # CI: fail if either output is out of date with catalog.json
```

Entries already in the catalog are checked against their source repo on every
sync, so they stay listed after the skills are uninstalled locally. That makes
it safe to install only `jabraf-skills-index` globally: to add a new skill,
install it with `npx skills add`, run the sync, then remove it again.

A new skill lands in an "Unsorted" group, with its description's first sentence
as the "when" line. Move it into a group and rewrite that line. To leave a
skill out, add it to `skip`. Targets track each source repo's default branch,
because `skills use` cannot pin to a commit.

## Claude Code plugin marketplace

This repo is also a Claude Code marketplace (`jabraf`). It offers this repo's
skills as the `jabraf-skills` plugin, together with every plugin in the
catalog. Each one points to its own upstream repo, so plugins install with
their agents, commands, hooks and MCP servers, which the skills index cannot
load.

```
/plugin install jabraf-skills --marketplace jabranr/skills
/plugin install searchfit-seo --marketplace jabranr/skills
```

The one-step `--marketplace` form needs Claude Code 2.1.275 or later. On older
versions, run `/plugin marketplace add jabranr/skills` first, then
`/plugin install <plugin>@jabraf`.

## Install

Use the [`skills` CLI](https://github.com/vercel-labs/skills) — no clone, no
runtime deps in this repo. Examples use `<agent>` as a placeholder; substitute
any [supported agent](https://github.com/vercel-labs/skills#supported-agents)
(e.g. `claude-code`, `codex`, `cursor`, `opencode`).

```bash
# List available skills in this repo
npx skills add jabranr/skills --list

# Install everything (global)
npx skills add jabranr/skills -g -a <agent> --skill '*' -y

# Install one skill
npx skills add jabranr/skills -g -a <agent> --skill jabraf-prettier -y

# Install one workflows skill
npx skills add jabranr/skills -g -a <agent> --skill jabraf-workflows-pr-checks -y

# Install to multiple agents at once
npx skills add jabranr/skills -g -a <agent> -a claude-code --skill jabraf-prettier -y

# Project-scoped install (writes into the agent's project skills directory)
npx skills add jabranr/skills -a <agent> --skill jabraf-prettier -y

# Update / remove
npx skills update jabraf-prettier
npx skills remove jabraf-prettier
```

`npx skills` auto-detects installed agents when run without `-a`. See the
[CLI docs](https://github.com/vercel-labs/skills#install-a-skill) for the full
option set.

## License

MIT © Jabran Rafique
