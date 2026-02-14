# SKILL.md — Claw Core Daemon

> Start, stop, restart, and check claw_core daemon status. The agent can use these to ensure claw_core is running before executing commands.

---

## What This Skill Is For

- **Start** — start claw_core daemon (if not already running)
- **Stop** — stop the daemon
- **Restart** — stop and start
- **Status** — check if claw_core is running and responding

---

## CLI Commands

```bash
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore restart
openclaw clawcore status
```

---

## Auto-Start

When the claw-core plugin is enabled with `autoStart: true`, the daemon starts automatically when the OpenClaw gateway starts (via the `boot-claw-core` hook).

---

## Gateway RPC

`clawcore.status` — returns `{ running: boolean, code, stdout, stderr }`.
