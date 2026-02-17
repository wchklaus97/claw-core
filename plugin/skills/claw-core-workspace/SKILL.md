---
name: claw-core-workspace
description: How the Cursor agent works within the claw_core workspace. Covers shared_memory, shared_skills, sandboxing, and conventions. Use when Cursor agent starts a session or needs to understand workspace rules.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"🏠"}}
---

# Claw Core Workspace

This skill defines how the Cursor agent operates within the **claw_core workspace** (`~/Documents/claw_core/` by default). Read this before doing any work.

## Workspace Layout

```
~/Documents/claw_core/
├── WORKSPACE.md           # Workspace root doc — read this first every session
├── shared_memory/         # Persistent memory across sessions and agents
│   ├── YYYY-MM-DD.md      # Daily logs (raw notes, what happened)
│   ├── long-term.md       # Curated long-term memory (distilled insights)
│   └── <topic>.md         # Topic-specific memory (e.g. models.md, projects.md)
├── shared_skills/         # Skills available to all agents in this workspace
│   └── <skill-name>/
│       └── SKILL.md
└── projects/              # Symlinks or clones of projects the agent works on
```

## Every Session

When the Cursor agent starts a task in this workspace:

1. **Read `WORKSPACE.md`** — workspace rules and current state
2. **Read `shared_memory/YYYY-MM-DD.md`** — today's and yesterday's logs
3. **Check `shared_skills/`** — see if any skill applies to the current task
4. **Do the work** — stay inside the workspace directory
5. **Write memory** — log decisions, results, and context to shared_memory

## shared_memory/

Memory that survives across sessions and is shared between all agents.

### What to write

- Decisions made and why
- Task results and outcomes
- Context that future sessions need
- Lessons learned, mistakes to avoid
- Model configurations, tool preferences

### Conventions

| File | Purpose | When to write |
|------|---------|---------------|
| `YYYY-MM-DD.md` | Daily raw log | Every session — append what happened |
| `long-term.md` | Curated insights | Periodically — distill from daily logs |
| `models.md` | Model configs, rankings, notes | After model selection/comparison tasks |
| `projects.md` | Active projects, status, notes | When project state changes |

### Format

```markdown
## HH:MM — Brief title

- What was done
- Decisions made (and why)
- Results or output summary
- Follow-ups needed
```

### Rules

- **Append, don't overwrite** daily logs — each entry is timestamped
- **long-term.md is curated** — review daily logs periodically, keep what matters
- **No secrets** in shared_memory unless explicitly asked
- **Topic files are optional** — create when a topic has enough recurring context

## shared_skills/

Skills available to all agents working in this workspace. Same format as plugin skills.

### Structure

```
shared_skills/
└── my-skill/
    └── SKILL.md
```

### How to use

1. **Before starting a task**, list `shared_skills/` to see what's available
2. **Read the SKILL.md** if a skill matches the task
3. **Follow it** — same as any other skill

### How to add skills

- **Copy from plugin:** `cp -r plugin/skills/<name> shared_skills/`
- **Create new:** make a folder + SKILL.md in `shared_skills/`
- **Install from OpenClaw:** skills installed via plugin go to `~/.openclaw/skills/`, but you can symlink or copy to `shared_skills/` for workspace-level access

### When to create a new shared skill

- A task pattern repeats across sessions
- Multiple agents need the same workflow
- A procedure is complex enough to document

## Sandboxing

The Cursor agent is **sandboxed to this workspace directory**:

- **Can read/write**: anything inside `~/Documents/claw_core/`
- **Cannot modify**: files outside the workspace (unless explicitly allowed)
- **Projects**: use the `projects/` directory for symlinks to external repos

### Working with external projects

If the Cursor agent needs to work on a project outside the workspace:

1. **Symlink it** into `projects/`: `ln -s /path/to/project projects/project-name`
2. **Or clone it**: `git clone <url> projects/project-name`
3. Work inside `projects/project-name/` — still within the workspace

### Changing the workspace

User can set a different workspace with:

```bash
openclaw clawcore setup-cursor --workspace /path/to/new/workspace
openclaw gateway restart
```

But the **root working directory** for the Cursor agent is always the configured workspace. Even when the task references external paths, execution starts from the workspace root.

## Conventions

| Item | Convention |
|------|-----------|
| Memory files | `shared_memory/YYYY-MM-DD.md` (daily), `shared_memory/long-term.md` (curated) |
| Skill folders | `shared_skills/<skill-name>/SKILL.md` |
| Project links | `projects/<project-name>` (symlinks or clones) |
| Timestamps | `HH:MM` in daily logs, `YYYY-MM-DD` in filenames |
| Secrets | Never in shared_memory unless asked; use env vars or `.env` files |

## Init and Reset

### Initialize workspace (first time or standalone)

```bash
openclaw clawcore init-workspace
```

Creates `~/Documents/claw_core/` with `shared_memory/`, `shared_skills/`, `projects/`, `WORKSPACE.md`, `.gitignore`. Skips anything that already exists.

### Reset workspace (start fresh)

```bash
openclaw clawcore reset-workspace
```

What reset does:
1. **Backs up `shared_memory/`** to `.backups/shared_memory-YYYY-MM-DDTHH-MM-SS/`
2. Clears the workspace (keeps `.backups/`)
3. Recreates all directories and templates from scratch

Backups are preserved — nothing is permanently lost.

### Custom workspace path

```bash
openclaw clawcore init-workspace --workspace /path/to/workspace
openclaw clawcore reset-workspace --workspace /path/to/workspace
```

## Quick Reference

```bash
# Initialize workspace
openclaw clawcore init-workspace

# Reset workspace (backs up memory first)
openclaw clawcore reset-workspace

# Check workspace
ls ~/Documents/claw_core/

# Read today's memory
cat shared_memory/$(date +%Y-%m-%d).md

# List available skills
ls shared_skills/

# Add a project
ln -s /path/to/repo projects/repo-name

# Change workspace
openclaw clawcore setup-cursor --workspace /new/path && openclaw gateway restart
```
