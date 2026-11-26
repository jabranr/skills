---
name: jabraf-prettier
description: Set up Prettier in a project using `@jabraf/dev`'s shared base config, or fix/migrate a project on the legacy `@jabraf/prettier` config. Load when the user asks to add Prettier, set up code formatting, configure `.prettierrc`, wire up `@jabraf/dev` Prettier, or mentions `@jabraf/prettier`. Do not load for general formatter questions unrelated to `@jabraf/dev`.
---

# `jabraf-prettier`

Adds Prettier to the current project by re-exporting `basePrettierConfig` from
[`@jabraf/dev`](https://www.npmjs.com/package/@jabraf/dev). Prose-only — no
helper scripts. You (the agent) run the commands, read the file system, and
confirm with the user before any irreversible step.

The canonical setup snippet lives in
[`packages/jabraf-dev/README.md`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#prettier).
If this file and the README disagree, trust the README.

## When to load this skill

Load when the user's prompt mentions any of:

- "Prettier", "code formatting", "format on save"
- "`.prettierrc`", "`prettier.config`", "prettier setup"
- "`@jabraf/dev` Prettier", "jabraf prettier", "`@jabraf/prettier`"

Do not load for general "format my code" requests that don't imply Prettier or
`@jabraf/dev`. Do not load alongside `jabraf-dev-setup` — the umbrella skill
will invoke this one.

## Conversation flow

Each numbered step is one agent message. Steps marked **[wait for user]**
require a user response before continuing.

1. **Brief acknowledge.** One sentence: "I'll add Prettier via `@jabraf/dev`.
   That's: detect package manager, install the dep if missing, write
   `.prettierrc.mjs`, add `format:check` / `format:fix` scripts, validate. Proceed?"
   **[wait for user]**

2. **Detect package manager.** Look for the lockfile in the project root:
   `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm. If
   none exist, default to npm and mention it. If multiple exist, ask the user
   which to use. **[wait for user if ambiguous]**

3. **Detect existing config.** Check for any of `.prettierrc`, `.prettierrc.{js,cjs,mjs,mts,json,yaml,yml,toml}`, `prettier.config.{js,cjs,mjs,mts}`, or a `prettier` field in `package.json`. If the existing config is the legacy `@jabraf/prettier` (for example `"prettier": "@jabraf/prettier"`), also run the [legacy check](#legacy-jabrafprettier) below before asking. If found, show the file contents (or the field) and ask: "An existing Prettier config was found. Replace with the `@jabraf/dev` re-export, leave it alone, or keep both side by side?" **[wait for user]** Never overwrite silently.

4. **Install `@jabraf/dev` if missing.** Check `package.json` `dependencies` and `devDependencies`. If `@jabraf/dev` is absent, install it as a dev dep using the detected package manager:
   - npm: `npm install --save-dev @jabraf/dev`
   - yarn: `yarn add --dev @jabraf/dev`
   - pnpm: `pnpm add --save-dev @jabraf/dev`

   Install at `latest` (no pin) per the skill repo policy. If already installed, skip.

5. **Write the config.** Default to `.prettierrc.mjs` at the project root with this exact body:

   ```js
   import basePrettierConfig from '@jabraf/dev/prettier';

   export default basePrettierConfig;
   ```

   If the project's `package.json` has `"type": "commonjs"` or no `type` field and the user prefers a CommonJS-only setup, offer the `package.json` field alternative instead:

   ```jsonc
   {
     "prettier": "@jabraf/dev/prettier",
   }
   ```

   Confirm the chosen variant before writing. **[wait for user]**

6. **Add scripts.** Add the following to `package.json` `scripts`, but **only if the script key is absent** — never overwrite an existing one. If the key exists with different content, show the diff and ask. **[wait for user if conflict]**

   ```jsonc
   {
     "scripts": {
       "format:check": "prettier --check .",
       "format:fix": "prettier --write .",
     },
   }
   ```

7. **Validate.** Run `<pm> run format:check` (e.g. `npm run format:check`). Report the outcome:
   - Exit 0: report "Prettier is set up and the codebase already matches the base config."
   - Non-zero with formatting diffs: report "Prettier is set up. `format:fix` will rewrite N file(s) to match the base config — run it when you're ready."
   - Non-zero with a different error (module not found, parse error): surface the error and stop.

8. **Final report.** Print a short summary:
   - Package manager detected
   - Whether `@jabraf/dev` was installed or already present
   - Which config file was written
   - Which scripts were added
   - Validation outcome

## Things you must NOT do

- Do not overwrite an existing Prettier config without explicit confirmation.
- Do not overwrite existing `package.json` scripts without explicit confirmation.
- Do not pin `@jabraf/dev` to a specific version — install at `latest`.
- Do not run `format:fix` as part of setup. Validation runs `format:check` (read-only) only.
- Do not edit any project files beyond `.prettierrc.mjs` (or the chosen variant) and `package.json` `scripts`.
- Do not install Prettier itself as a direct dep — it comes as a transitive dep of `@jabraf/dev`.

## Edge cases

| Situation                                                              | Action                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Project has no `package.json`                                          | Stop. Ask the user to initialise the project first (`npm init -y`).                                                                             |
| `package.json` `type` field is missing and you wrote `.prettierrc.mjs` | Confirm Node can load it (Node ≥ 14 with `.mjs` works regardless of `type`). No change needed; mention this in the final report.                |
| Monorepo (`workspaces` field present)                                  | Ask whether to add Prettier at the repo root, in a specific workspace, or both. **[wait for user]** Repeat steps 3–7 in the chosen location(s). |
| Existing `.prettierignore`                                             | Leave it alone. The `@jabraf/dev` base config does not ship a `.prettierignore`; the user's existing one stays in effect.                       |
| Project uses legacy `@jabraf/prettier`                                 | Run the [legacy check](#legacy-jabrafprettier). Fix the Prettier version or migrate, per the user's choice. **[wait for user]**                 |
| `@jabraf/dev` already pinned to an older version                       | Ask whether to upgrade to `latest`. **[wait for user]** Do not auto-upgrade.                                                                    |
| Network/install failure                                                | Surface the package manager error verbatim and stop. Do not retry silently.                                                                     |

## Legacy `@jabraf/prettier`

`@jabraf/prettier` ([`jabranr/prettier-config`](https://github.com/jabranr/prettier-config)) is an older standalone config. It is not the `@jabraf/dev` base, and its defaults differ: `printWidth: 80` and `trailingComma: 'none'`. It ships an ES module config and needs **Prettier ≥ 3.4**. Older Prettier does not fail. It prints `Ignored unknown option { default: ... }` and formats with Prettier's defaults:

- Prettier 2.x (e.g. `2.2.1`) can't load ES module configs.
- Prettier 3.0–3.3 on Node ≥ 22.12 reads the module wrapper instead of the config.

Versions up to 3.0.1 declared `prettier: "*"`, so npm reused whatever Prettier the project already had. From 3.1.0 it declares `prettier: ^3.4.0` as a peer dependency, so an older Prettier fails at install with `ERESOLVE`.

When you find it:

1. Run `npm ls prettier @jabraf/prettier` (or the pnpm/yarn equivalent) and report both versions.
2. If Prettier is older than 3.4 or the warning above appears, tell the user the config is being ignored. Offer one of these:
   - **Migrate** to `@jabraf/dev` (steps 4–7). This changes formatting to the `@jabraf/dev` base.
   - **Keep** `@jabraf/prettier`: upgrade it and Prettier together with `npm install --save-dev prettier@^3.4.0 @jabraf/prettier@latest`.

   **[wait for user]**

3. Never change formatting style silently. Say that `format:check` will show diffs after either fix, because the config was not being applied before.

## Reference

- `@jabraf/dev` Prettier docs: [`packages/jabraf-dev/README.md#prettier`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/README.md#prettier)
- Subpath export: `@jabraf/dev/prettier` → `./dist/config/code-formatting/prettier.base.js` (see [`packages/jabraf-dev/package.json`](https://github.com/jabranr/jabraf-tools/blob/main/packages/jabraf-dev/package.json) `exports` map)
- Both default and named (`basePrettierConfig`) exports are available; the README's default-import form is the canonical recommendation.
