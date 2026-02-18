---
name: cursor-agent
description: Invoke Cursor Agent for coding and complex tasks. Use cursor_agent_direct tool (preferred) or sessions_spawn with agentId cursor-dev. NEVER exec agent/cursor agent directly (hangs with text format). Cursor CLI does not support image generation.
metadata: {"openclaw":{"requires":{"bins":["agent","cursor"]},"emoji":"⌘"}}
---

# Cursor Agent — Direct Tool

**Use gpt-4o-mini (yourself) first.** Only delegate to Cursor when the user explicitly asks for Cursor, or the task is large/multi-file.

## Primary Method: `cursor_agent_direct` Tool

The **`cursor_agent_direct`** tool invokes Cursor Agent directly with structured JSON output. This is the preferred method for all Cursor interactions.

```
cursor_agent_direct(
  prompt: "Your detailed task description",
  workspace: "/path/to/project",   // optional
  model: "auto",                    // optional, default "auto"
  mode: "agent" | "plan" | "ask"    // optional, default "agent"
)
```

### Modes

- **agent** (default): Execute code changes and commands. Use for "do this" tasks (implement, refactor, run). Cursor may use auto-run internally.
- **plan**: Plan before executing. Use when the user says "plan first," "design approach," or for large/ambiguous tasks. Cursor researches the codebase and may ask clarifying questions before executing.
- **ask**: Read-only. Use for "explain," "where is," "why does" — no edits. Safer for code exploration and analysis.

### When to Use

- User explicitly asks for "Cursor," "cursor agent," "cursor-dev," or "use Cursor"
- **Coding tasks**: write, edit, refactor, review code
- **Complex multi-file operations**: Cursor understands full codebase context
- **Analysis**: deep code analysis, dependency checking, architecture review
- Task is large or multi-file
- User asks to "try with Cursor"

**Note:** Cursor CLI does **not** support image generation. Do not promise or attempt to generate images via Cursor.

### Output

The tool returns structured JSON:
- `output`: Cursor's text response
- `exit_code`: 0 for success
- `duration_ms`: execution time
- `files_created`: list of new file paths (code and artifacts)
- `truncated`: true if output was capped at 100KB

## Fallback Method: sessions_spawn via Claw Core

If `cursor_agent_direct` tool is not available, use **sessions_spawn** to delegate to the `cursor-dev` agent. This is the only valid fallback — do NOT exec cursor directly.

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

- **agentId**: `"cursor-dev"` (uses cursor-cli/auto)
- **task**: The user's request verbatim or a concise summary
- **runTimeoutSeconds**: 300–600 (Cursor can run long)

## Error Handling — No Further Interaction

### When `cursor_agent_direct` returns `ok: false`:

1. **Read the `error` or `output` field** — it contains the failure reason
2. **Report it to the user directly** — do not retry
3. **Do NOT** exec cursor, spawn processes, or poll — these all hang or fail the same way
4. If sessions_spawn is available, try that once as fallback — if it also fails, report to user

### Common errors and what to tell the user:

| Error | Tell user |
|---|---|
| `cursor CLI not found` | Run `openclaw clawcore setup-cursor` to configure Cursor integration |
| `agentId is not allowed` | Run `openclaw clawcore setup-cursor` to register the cursor-dev agent |
| `timed out` | Task was too long — try breaking it into smaller steps |
| Empty output | Cursor may not be logged in — run `agent login` or `cursor agent login` |

## Prerequisites

- Run `openclaw clawcore setup-cursor` if you get `agentId is not allowed for sessions_spawn`
- Cursor CLI must be installed: `agent` or `cursor` on PATH
- Logged in: `agent login` or `cursor agent login`

## Do NOT

- Do NOT run `exec agent --print "..."` or `exec cursor agent --print "..."` — hangs with no output
- Do NOT use exec to invoke Cursor in any form — always use `cursor_agent_direct` tool or `sessions_spawn`
- Do NOT promise image generation via Cursor — the CLI does not support it
