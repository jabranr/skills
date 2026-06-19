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
supported agent (Augment, Claude Code, Codex, Cursor, OpenCode, and others).

## Layout

```
skills/
  # @jabraf/dev tooling
  jabraf-prettier/SKILL.md
  jabraf-eslint/SKILL.md
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
  jabraf-workflows-actionlint/SKILL.md
  jabraf-workflows-wait-cf-pages/SKILL.md
  jabraf-workflows-performance-audit/SKILL.md
```

## Install

Use the [`skills` CLI](https://github.com/vercel-labs/skills) — no clone, no
runtime deps in this repo. Examples target Augment globally; swap `-a augment`
for any [supported agent](https://github.com/vercel-labs/skills#supported-agents).

```bash
# List available skills in this repo
npx skills add jabranr/skills --list

# Install everything to Augment (global)
npx skills add jabranr/skills -g -a augment --skill '*' -y

# Install one skill
npx skills add jabranr/skills -g -a augment --skill jabraf-prettier -y

# Install one workflows skill
npx skills add jabranr/skills -g -a augment --skill jabraf-workflows-pr-checks -y

# Install to multiple agents at once
npx skills add jabranr/skills -g -a augment -a claude-code --skill jabraf-prettier -y

# Project-scoped install (writes into ./.augment/skills/)
npx skills add jabranr/skills -a augment --skill jabraf-prettier -y

# Update / remove
npx skills update jabraf-prettier
npx skills remove jabraf-prettier
```

`npx skills` auto-detects installed agents when run without `-a`. See the
[CLI docs](https://github.com/vercel-labs/skills#install-a-skill) for the full
option set.

## License

MIT © Jabran Rafique
