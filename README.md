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
