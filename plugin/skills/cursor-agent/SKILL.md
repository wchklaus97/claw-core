---
name: cursor-agent
description: Delegate to Cursor CLI when the user asks for Cursor or when a coding task is large/multi-file. Use sessions_spawn with agentId cursor-dev — NEVER exec agent/cursor agent (hangs with text format).
metadata: {"openclaw":{"requires":{"bins":["agent","cursor"]},"emoji":"⌘"}}
---

# Cursor CLI Agent

**Use gpt-4o-mini (yourself) first.** Only delegate to Cursor when the user explicitly asks for Cursor, or the task is large/multi-file.

## When to delegate to Cursor

- User explicitly asks for "Cursor," "cursor agent," "cursor-dev," or "use Cursor"
- Task is large or multi-file
- User asks to "try with Cursor"

## How to delegate (required)

Use **sessions_spawn** to delegate to the `cursor-dev` agent. Do NOT use exec to run `agent` or `cursor agent` — it hangs in headless mode with default text format.

```json
{
  "tool": "sessions_spawn",
  "params": {
    "agentId": "cursor-dev",
    "task": "<user's prompt or task summary>",
    "runTimeoutSeconds": 600
  }
}
```

- **agentId**: `"cursor-dev"` (uses cursor-cli/auto — model set to auto)
- **task**: The user's request verbatim or a concise summary
- **runTimeoutSeconds**: 300–600 (Cursor can run long)

## Prerequisites

- Run `openclaw clawcore setup-cursor` if you get `agentId is not allowed for sessions_spawn`
- Cursor CLI must be installed: `agent` or `cursor` on PATH
- Logged in: `agent login` or `cursor agent login`

## Do NOT

- Do NOT run `exec agent --print "..."` or `exec cursor agent --print "..."` — hangs with no output
- Do NOT use exec to invoke Cursor in any form
