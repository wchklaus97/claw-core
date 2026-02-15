---
name: cursor-agent
description: Invoke Cursor Agent for coding, image generation, and complex tasks. Use cursor_agent_direct tool (preferred) or sessions_spawn with agentId cursor-dev. NEVER exec agent/cursor agent directly (hangs with text format).
metadata: {"openclaw":{"requires":{"bins":["agent","cursor"]},"emoji":"⌘"}}
---

# Cursor Agent — Direct Tool + Image Generation

**Use gpt-4o-mini (yourself) first.** Only delegate to Cursor when the user explicitly asks for Cursor, or the task is large/multi-file.

## Primary Method: `cursor_agent_direct` Tool

The **`cursor_agent_direct`** tool invokes Cursor Agent directly with structured JSON output. This is the preferred method for all Cursor interactions.

```
cursor_agent_direct(
  prompt: "Your detailed task description",
  workspace: "/path/to/project",   // optional
  model: "auto"                     // optional, default "auto"
)
```

### When to Use

- User explicitly asks for "Cursor," "cursor agent," "cursor-dev," or "use Cursor"
- **Coding tasks**: write, edit, refactor, review code
- **Image generation**: Cursor 2.4+ has built-in image gen via auto model
- **Complex multi-file operations**: Cursor understands full codebase context
- **Analysis**: deep code analysis, dependency checking, architecture review
- Task is large or multi-file
- User asks to "try with Cursor"

### Image Generation

Cursor handles image generation natively. No extra API keys needed:

```
cursor_agent_direct(prompt: "Generate an image of a futuristic robot, 3D render style, blue lighting")
```

Generated images are saved to the workspace `assets/` folder. The tool returns file paths of created images.

### Output

The tool returns structured JSON:
- `output`: Cursor's text response
- `exit_code`: 0 for success
- `duration_ms`: execution time
- `files_created`: list of new file paths (especially images)
- `truncated`: true if output was capped at 100KB

## Fallback Method: sessions_spawn via Claw Core

If `cursor_agent_direct` tool is not available, use **sessions_spawn** to delegate to the `cursor-dev` agent. Do NOT use exec to run `agent` or `cursor agent` — it hangs in headless mode with default text format.

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

### Output Format Options

```bash
cursor agent "<prompt>" --print --output-format json
cursor agent "<prompt>" --print --output-format stream-json
```

## Prerequisites

- Run `openclaw clawcore setup-cursor` if you get `agentId is not allowed for sessions_spawn`
- Cursor CLI must be installed: `agent` or `cursor` on PATH
- Logged in: `agent login` or `cursor agent login`
- **Auto model** is recommended — Cursor picks the best model for each task
- For image generation, auto model includes dedicated image generation models

## Do NOT

- Do NOT run `exec agent --print "..."` or `exec cursor agent --print "..."` — hangs with no output
- Do NOT use exec to invoke Cursor in any form — always use `cursor_agent_direct` tool or `sessions_spawn`
