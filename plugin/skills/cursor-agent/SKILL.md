---
name: cursor-agent
description: Delegate to Cursor CLI when the user asks for Cursor or when a coding task is large/multi-file. Otherwise use Qwen and your own tools first.
metadata: {"openclaw":{"requires":{"bins":["cursor"]},"emoji":"⌘"}}
---

# Cursor CLI Agent

**Use Qwen (yourself) first.** Only delegate to Cursor CLI when the user explicitly asks for Cursor, or the task is large/multi-file.

## When to delegate to Cursor

- User explicitly asks for "Cursor," "cursor agent," or "use Cursor"
- Task is large or multi-file
- User asks to "try with Cursor"

## How to run

```bash
cursor agent "<prompt>" --print [--workspace <path>] [--model <model>]
```

- Use **exec** with the command above
- **workdir**: project root when relevant
- **timeout**: 300–600 seconds (Cursor can run long)

## Notes

- CLI subcommand is `agent`, not `cursor-agent`
- Cursor must be installed and on PATH
- User must be logged in (`cursor agent login`) or have `CURSOR_API_KEY`
