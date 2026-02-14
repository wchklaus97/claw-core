---
name: status-dashboard
description: Display current status of Claw Core sessions, OpenClaw cron jobs, and recent activity. Use when user asks for status/overview/dashboard.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"📊"}}
---

# Status Dashboard

Display: claw_core runtime status, active sessions, cron jobs, recent activity.

## When to use

- "status" / "狀態" / "dashboard" / "總覽"
- "列出目前的 session 和 cron"

## How to run

```bash
python3 $PLUGIN_ROOT/scripts/status_dashboard.py
```

`$PLUGIN_ROOT` = plugin install dir (e.g. `~/.openclaw/extensions/claw-core`).
