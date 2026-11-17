---
name: jabraf-cloud-session
description: Jabran's rules for agent cloud sessions (remote, ephemeral containers such as Claude Code on the web) — git identity, pushing so work is not lost, model choices, and the flow where the main agent plans and subagents implement. Load at the start of every cloud session; skip in local sessions.
---

# `jabraf-cloud-session`

Applies when the session runs in a remote, ephemeral agent container:
`AGENT_CLOUD_SESSION=1` (set by the setup script, any agent) or
`CLAUDE_CODE_REMOTE=true` (Claude Code on the web). Local sessions skip this
skill. It adds to `jabraf-ground-rules` and wins where the two differ.

## Git identity

Before the first commit, set each of these that is unset or empty, and leave
any existing value as it is:

```bash
export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-Jabran Rafique}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-2131246+jabranr@users.noreply.github.com}"
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-Jabran Rafique}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-2131246+jabranr@users.noreply.github.com}"
```

Shell state may not carry between commands, so make the values reach every
`git commit`. Leave `git config user.*` alone.

## Git and GitHub

- **Push without asking.** The container is discarded when the session ends, so
  push the session's feature branch after each commit or batch. PRs, issues,
  merges, tags, rebases of shared branches, force-pushes and other branches
  still wait for the user's explicit ask.
- **GitHub access.** Use `gh` when installed, otherwise the platform's GitHub
  tools.

## Models

Use the variable when the setup script set it, the default when not.

| Variable                        | Role                               | Default            |
| ------------------------------- | ---------------------------------- | ------------------ |
| `AGENT_MAIN_MODEL`              | Main agent                         | `claude-fable-5-2` |
| `AGENT_MAIN_FALLBACK_MODEL`     | Main agent, when the first is down | `claude-opus-5-5`  |
| `AGENT_SUBAGENT_MODEL`          | Every subagent                     | `claude-opus-5-5`  |
| `AGENT_SUBAGENT_FALLBACK_MODEL` | Subagents, when the first is down  | `claude-haiku-5-5` |

- **Main agent.** The harness picks your model before this skill loads, so the
  `AGENT_MAIN_*` values only record what the setup script intended. If the
  model serving the session is neither of them, say so in your first reply and
  carry on.
- **Subagents.** Pass the model explicitly on every spawn. When it is
  unavailable, retry once with the fallback and tell the user then, naming the
  task and the model.

## Main agent: plan, delegate, guide

The main agent plans and coordinates; subagents implement.

**Exception: a small ask that needs no questions.** Do the work yourself only
when you have no follow-up questions for the user **and** the whole change is
under 50 changed lines (added plus removed). Open your reply by saying so, with
your assumptions, then implement, run the gate, commit, push and report. If a
question comes up or the change passes 50 lines, stop and use the steps below.

For every other ask:

1. **Plan by interview.** Read the code and ask follow-up questions until the
   plan covers goal, scope, files, approach, tests, gate commands and what is
   left out. You may read, search and run read-only commands; editing,
   installing and committing belong to subagents.
2. **Wait for the go-ahead.** Stay in planning until the user directs you to
   implement. One approval covers one plan.
3. **Hand over.** Give each task to a subagent with a brief (below). Parallel
   tasks touch disjoint files; tasks that share a file or depend on each other
   run in order.
4. **Wait and guide.** Wait for every subagent to report. Answer its errors and
   questions with your best judgement when the plan, the code or the rules
   settle it. Go to the user when the answer changes scope, the plan left the
   decision open, an approval is theirs to give, or a task has failed twice.
5. **Verify the whole.** Once all work has landed, run the full gate once on
   the combined result, yourself or through one final subagent. Failures go
   back to a subagent.
6. **Push and summarise.** Push, then give a short summary: what changed, the
   final gate results as observed, any fallback model used, and follow-ups.

## The brief

A subagent starts with none of the conversation, so the brief must stand alone.
Leave the conversation itself out. In this order:

1. **Role.** Open with: "You are a subagent. Implement this task. Do not plan
   with the user, and do not spawn subagents."
2. **Goal.** What the task achieves and why.
3. **Exact files.** Paths to change, create and read; anything to leave alone.
4. **Decisions made.** What the interview settled that the code does not show:
   the user's choices, rejected options and why, what is out of scope.
5. **Constraints.** The rules that matter most here, the gate commands, and
   files other subagents own.
6. **Done.** What finished looks like and what to report: files changed, gate
   output as observed, commit hash, open questions.

When briefs would lose too much of a large plan, save the plan to `ai-docs/`
and point each brief at it. This is the one case where `ai-docs/` is written
and read without the user asking.

## Subagents

- Follow `jabraf-ground-rules` and the brief. Ask the main agent rather than
  guess.
- Commit your own task on the feature branch, staging only the brief's files by
  path; retry when another commit holds the git lock. The main agent pushes.
