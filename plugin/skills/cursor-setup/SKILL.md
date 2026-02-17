---
name: cursor-setup
description: Set up Cursor CLI integration in openclaw.json. Adds cliBackends, cursor-dev agent, and subagents.allowAgents. Default workspace is ~/Documents/claw_core with shared_memory and shared_skills.
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🔧"}}
---

# Cursor Integration Setup

Configures `~/.openclaw/openclaw.json` so OpenClaw can delegate tasks to Cursor CLI.

## Default Workspace

The Cursor agent is sandboxed to a **root workspace** directory:

```
$WORKSPACE/          # Path varies by agent (see below)
├── shared_memory/   # Memory shared across sessions and agents
├── shared_skills/   # Skills shared across sessions and agents
├── generated/       # Agent-generated output (images, files)
└── ...              # User files, project symlinks, etc.
```

### Workspace Location by Agent

| Agent | Workspace Path | When Used |
|-------|----------------|-----------|
| `cursor-dev` (main) | `~/Documents/claw_core/` | Default single-user setup |
| Telegram bots | `~/.openclaw/workspace-{bot_id}/` | Multi-bot telegram setups |
| Custom agents | Defined in `agents.list[].workspace` | Per-agent isolation |

- **Created automatically** on first setup (including `shared_memory/`, `shared_skills/`, `generated/`)
- Cursor agent can only work inside its assigned workspace directory
- User can override with `--workspace` flag on setup or per-tool-call `workspace` parameter

## When to use

- User asks to "set up Cursor integration" / "設定 Cursor" / "enable Cursor"
- User asks to "change Cursor working directory" / "切換 Cursor 工作目錄"
- User sees `agentId is not allowed for sessions_spawn`
- User wants to use `cursor-dev` agent or `cursor-cli` backend

## What it does

1. Creates workspace directory + `shared_memory/` + `shared_skills/`
2. Adds `agents.defaults.cliBackends` (cursor-cli, cursor-plan, cursor-ask)
3. Adds `agents.list` with main agent (`subagents.allowAgents: ["*"]`) and `cursor-dev` agent
4. Sets `agents.defaults.workspace`

## How to run

```bash
# Default workspace (~/Documents/claw_core)
openclaw clawcore setup-cursor

# Custom workspace
openclaw clawcore setup-cursor --workspace /path/to/project
```

After running, restart the gateway:

```bash
openclaw gateway restart
```

## Changing the workspace

The **workspace** is the working directory the Cursor agent (cursor-dev) runs in. To change it:

```bash
openclaw clawcore setup-cursor --workspace /path/to/new/project
openclaw gateway restart
```

This updates:
- `agents.defaults.workspace`
- `agents.defaults.cliBackends.*.args` (the `--workspace` value passed to Cursor CLI)
- `cursor-dev.workspace`
- Creates `shared_memory/` and `shared_skills/` in the new workspace if missing

When the user asks Cursor agent to do something, the root working directory is always the configured workspace — regardless of what project paths the task references.

## Notes

- Safe to run multiple times (idempotent); re-running with `--workspace` updates the workspace
- Requires `agent` or `cursor` CLI on PATH (setup prefers `agent` when available)
- `shared_memory/` persists across sessions — use for context that should survive restarts
- `shared_skills/` holds skills available to all agents working in this workspace
