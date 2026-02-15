---
name: cursor-agent
description: Invoke Cursor Agent for coding, image generation, and complex tasks. Use cursor_agent_direct tool (preferred) or exec with cursor agent CLI (fallback).
metadata: {"openclaw":{"requires":{"bins":["cursor"]},"emoji":"⌘"}}
---

# Cursor Agent — Direct Tool + Image Generation

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

- **Coding tasks**: write, edit, refactor, review code
- **Image generation**: Cursor 2.4+ has built-in image gen via auto model
- **Complex multi-file operations**: Cursor understands full codebase context
- **Analysis**: deep code analysis, dependency checking, architecture review
- **Any task requiring Cursor's full capabilities**

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

## Fallback Method: Exec via Claw Core

If `cursor_agent_direct` tool is not available, use `exec` to run Cursor CLI:

```bash
cursor agent "<prompt>" --print [--workspace <path>] [--model <model>]
```

- Use **exec** with the command above
- **workdir**: project root when relevant
- **timeout**: 300–600 seconds (Cursor can run long)

### Output Format Options

```bash
cursor agent "<prompt>" --print --output-format json
cursor agent "<prompt>" --print --output-format stream-json
```

## Notes

- CLI subcommand is `agent`, not `cursor-agent`
- Cursor must be installed and on PATH
- User must be logged in (`cursor agent login`) or have API key configured
- **Auto model** is recommended — Cursor picks the best model for each task
- For image generation, auto model includes dedicated image generation models
