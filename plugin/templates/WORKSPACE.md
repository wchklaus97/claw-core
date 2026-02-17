# Claw Core Workspace

This is your working directory. Everything you do happens here.

## Every Session

1. Read this file
2. Read `shared_memory/` — today's + yesterday's daily log
3. Check `shared_skills/` — use any that match your task
4. Do the work
5. Log what happened to `shared_memory/YYYY-MM-DD.md`

## Structure

```
shared_memory/     Persistent memory across sessions and agents
shared_skills/     Skills available to all agents here
projects/          Symlinks or clones of external projects
```

## shared_memory

- **Daily logs:** `shared_memory/YYYY-MM-DD.md` — append what happened each session
- **Long-term:** `shared_memory/long-term.md` — curated insights, distilled from daily logs
- **Topic files:** `shared_memory/<topic>.md` — recurring context (models, projects, etc.)

Write decisions, results, and context. Future-you wakes up with no memory — these files are your continuity.

## shared_skills

Skills are folders with a `SKILL.md`. Check what's available before starting a task. If a skill matches, read and follow it.

### Pre-installed skills (Cursor-compatible only)

**Workflow (from [superpowers](https://github.com/obra/superpowers)):**
- `brainstorming` — Socratic design refinement before creative work
- `writing-plans` — Detailed implementation plans from requirements
- `executing-plans` — Batch execution with review checkpoints
- `using-git-worktrees` — Isolated branches for feature work
- `finishing-a-development-branch` — Merge/PR decision workflow

**Testing & Quality:**
- `test-driven-development` — RED-GREEN-REFACTOR cycle
- `systematic-debugging` — 4-phase root cause analysis
- `verification-before-completion` — Verify before claiming done

**Collaboration:**
- `requesting-code-review` — Pre-review checklist
- `receiving-code-review` — Responding to feedback

**Workspace & Meta:**
- `claw-core-workspace` — How to work in this workspace
- `model-selection-agent` — Model selection criteria (free + paid)
- `writing-skills` — Create new skills

**Not included** (don't apply in Cursor):
- ~~dispatching-parallel-agents~~ — no parallel agent dispatch in Cursor
- ~~subagent-driven-development~~ — Cursor does steps sequentially (covered by executing-plans)
- ~~using-superpowers~~ — meta intro, redundant when skills are already here

To add more: copy a skill folder here, or create `shared_skills/<name>/SKILL.md`.

## Projects

Work on external repos by symlinking them into `projects/`:

```bash
ln -s /path/to/repo projects/repo-name
```

Then work inside `projects/repo-name/` — still within the workspace.

## Rules

- Stay inside this directory
- Append to daily logs, don't overwrite
- No secrets in shared_memory unless asked
- When in doubt, check shared_skills first
