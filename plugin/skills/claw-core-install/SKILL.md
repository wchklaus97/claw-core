---
name: claw-core-install
description: Run full claw-core install or setup completion. Use when user asks to "install claw core", "set up claw core", "complete claw core setup", "安裝 Claw Core", or "啟動 claw daemon". Runs plugins install (if needed), daemon start, Cursor setup, and gateway restart.
metadata: {"openclaw":{"requires":{"bins":["node","openclaw"]},"emoji":"📦"}}
---

# Claw Core Install / Setup

Run the full install flow or complete setup after the plugin is installed.

## When to use

- User asks to "install claw core" / "set up claw core" / "安裝 Claw Core"
- User wants to complete first-time setup (daemon + Cursor)
- User installed the plugin manually and wants the agent to finish setup

## Full install flow (plugin not yet installed)

If the user does not have the plugin, run these in order:

```bash
openclaw plugins install @wchklaus97hk/claw-core
openclaw clawcore start
openclaw clawcore setup-cursor    # if user wants Cursor integration
openclaw gateway restart
```

## Setup completion (plugin already installed)

If the plugin is installed but daemon/Cursor not configured, run:

```bash
openclaw clawcore start
openclaw clawcore setup-cursor    # optional, for Cursor
openclaw gateway restart
```

## Steps summary

1. **Install plugin** (if needed): `openclaw plugins install @wchklaus97hk/claw-core`
2. **Start daemon**: `openclaw clawcore start` — auto-downloads binary on first run
3. **Cursor setup** (optional): `openclaw clawcore setup-cursor` — configures openclaw.json for Cursor CLI
4. **Restart gateway**: `openclaw gateway restart` — loads plugin and picks up config

## Notes

- The daemon auto-downloads the binary and configures openclaw.json on first `clawcore start`
- Use **exec** to run these commands; allow time for download and restart
- After gateway restart, claw-core skills become available
