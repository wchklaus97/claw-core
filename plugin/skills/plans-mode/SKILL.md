---
name: plans-mode
description: Structured planning and execution for multi-step tasks. Break down complex requests into steps (shell/Cursor/cron), then execute them systematically.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"📋"}}
---

# Plans Mode — Multi-Step Planning & Execution

Use when the user asks to **plan and execute** a complex, multi-step task.

## When to use

- "幫我規劃並執行：…" / "plan and execute: …"
- "分步驟做：…" / "break this down step by step"
- Task requires multiple stages (e.g. cron + Cursor + claw_core)

## Step types

- **[shell]** — exec (or claw_core wrapper)
- **[cursor]** — `cursor agent "<prompt>" --print`
- **[claw-session:NAME]** — claw_core session
- **[cron]** — OpenClaw cron tool
- **[manual]** — user action

## Paths

Use `$WORKSPACE` for project root, `$CLAW_ROOT` for claw repo.
