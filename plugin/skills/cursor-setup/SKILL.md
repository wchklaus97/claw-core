---
name: cursor-setup
description: Set up Cursor CLI integration in openclaw.json. Adds cliBackends, cursor-dev agent, and subagents.allowAgents. Use when user asks to "set up Cursor", "configure Cursor integration", or "enable Cursor".
metadata: {"openclaw":{"requires":{"bins":["node"]},"emoji":"🔧"}}
---

# Cursor Integration Setup

Configures `~/.openclaw/openclaw.json` so OpenClaw can delegate tasks to Cursor CLI.

## When to use

- User asks to "set up Cursor integration" / "設定 Cursor" / "enable Cursor"
- User sees `agentId is not allowed for sessions_spawn`
- User wants to use `cursor-dev` agent or `cursor-cli` backend

## What it does

1. Adds `agents.defaults.cliBackends` (cursor-cli, cursor-plan, cursor-ask)
2. Adds `agents.list` with main agent (`subagents.allowAgents: ["*"]`) and `cursor-dev` agent
3. Sets `agents.defaults.workspace` if not set

## How to run

```bash
# Default workspace (~/.openclaw/workspace)
node $PLUGIN_ROOT/scripts/setup-cursor-integration.js

# Custom workspace
node $PLUGIN_ROOT/scripts/setup-cursor-integration.js --workspace /path/to/project
```

`$PLUGIN_ROOT` = plugin install dir (e.g. `~/.openclaw/extensions/claw-core`).

After running, restart the gateway:

```bash
openclaw gateway restart
```

## CLI shortcut

```bash
openclaw clawcore setup-cursor
```

## Notes

- Safe to run multiple times (idempotent)
- Does not overwrite existing cliBackends or agents.list entries
- Requires `agent` or `cursor` CLI on PATH (setup prefers `agent` when available)
