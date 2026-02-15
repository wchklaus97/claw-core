---
name: claw-core-remove
description: Run full claw-core removal. Use when user asks to "remove claw core", "uninstall claw core", "卸載 Claw Core", or "remove claw-core plugin". Stops daemon, cleans openclaw.json and Cursor integration, removes skills, removes plugin dir.
metadata: {"openclaw":{"requires":{"bins":["node","openclaw"]},"emoji":"🗑️"}}
---

# Claw Core Remove

Run the full removal flow: stop daemon, clean config, remove skills, remove plugin.

## When to use

- User asks to "remove claw core" / "uninstall claw core" / "卸載 Claw Core"
- User wants to completely remove the claw-core plugin

## How to run

Run these commands in order (use **exec**):

```bash
openclaw clawcore teardown
rm -rf ~/.openclaw/extensions/claw-core
openclaw gateway restart
```

Or step by step:

```bash
openclaw clawcore teardown    # stops daemon + cleans openclaw.json and skills
rm -rf ~/.openclaw/extensions/claw-core
openclaw gateway restart      # agent session may end when plugin is removed
```

## What gets removed

1. Daemon stopped (claw_core process)
2. **openclaw.json** — plugins.entries.claw-core, plugins.installs.claw-core, load paths, skill entries, Cursor integration (cliBackends, cursor-dev agent)
3. **Skills** — all claw-core skills removed from ~/.openclaw/skills/
4. **Plugin dir** — ~/.openclaw/extensions/claw-core removed

## CLI shortcut

```bash
openclaw clawcore teardown
```

Runs stop + teardown script. You still need to remove the plugin dir and restart gateway.

## Notes

- The teardown script runs from the plugin dir — it must run before `rm -rf`
- After removal, gateway restart is needed to unload the plugin
- Safe to run multiple times (idempotent)
