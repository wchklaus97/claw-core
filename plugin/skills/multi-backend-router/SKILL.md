---
name: multi-backend-router
description: Smart routing between backends (Cursor Agent, PicoClaw, Claw Core). Automatically selects the best tool for each task type. Use for the developer agent or any multi-capable agent.
metadata: {"openclaw":{"requires":{"bins":[]},"emoji":"🔀"}}
---

# Multi-Backend Router

Automatically route tasks to the best backend based on the request type. This skill is especially useful for the developer agent which has access to all tools.

## Routing Table

| Request Type | Route To | Tool | Why |
|---|---|---|---|
| Complex coding / multi-file edits | Cursor Agent | `cursor_agent_direct` | Full codebase understanding, multi-file |
| Image generation / design | Cursor Agent | `cursor_agent_direct` | Built-in image gen with auto model |
| Code review / refactoring | Cursor Agent | `cursor_agent_direct` | Deep code analysis |
| Simple shell commands | Claw Core | `exec` (via session) | Fast, session-managed, structured |
| Build / test / deploy | Claw Core | `exec` (via session) | Timeout isolation, exit codes |
| Quick factual questions | PicoClaw | `picoclaw_chat` | Fast, web search capable |
| Web search / current events | PicoClaw | `picoclaw_chat` | Built-in web search |
| PicoClaw config changes | PicoClaw | `picoclaw_config` | Direct config management |
| Scheduled tasks | OpenClaw | `cron` tool | Native cron support |
| File read/write | Direct | `read` / `write` | No delegation needed |
| System status | Claw Core | `system.stats` | Runtime health info |

## Decision Logic

1. **Is it a coding task?** (write code, edit files, refactor, review)
   → Use `cursor_agent_direct`

2. **Is it a visual task?** (generate image, design, mockup)
   → Use `cursor_agent_direct` (Cursor has native image gen)

3. **Is it a shell command?** (run, build, test, deploy, install)
   → Use Claw Core `exec`

4. **Is it a question?** (what is, how does, when was, search for)
   → Use `picoclaw_chat`

5. **Is it about configuration?** (change model, show config)
   → Use `picoclaw_config`

6. **Is it about scheduling?** (every day, at 9am, cron)
   → Use `cron` tool

## User Overrides

Users can explicitly request a specific backend:
- "**Use Cursor** for this" → `cursor_agent_direct`
- "**Ask PicoClaw**" / "**use PicoClaw**" → `picoclaw_chat`
- "**Run this command**" / "**exec**" → Claw Core
- "**Generate an image**" → `cursor_agent_direct`

Always respect explicit user preferences over automatic routing.

## Fallback Behavior

If a backend is unavailable:
- **Cursor not installed**: Fall back to Claw Core `exec` with `cursor agent` command, or answer directly
- **PicoClaw not installed**: Answer the question directly using your own knowledge
- **Claw Core not running**: Use direct `exec` tool (without session management)

Always inform the user when falling back and suggest installing the missing backend.

## Multi-Step Tasks

For complex tasks that span multiple backends:
1. Break down into steps
2. Route each step to the appropriate backend
3. Show progress as each step completes
4. Summarize results at the end

Example: "Update dependencies and run tests"
1. `cursor_agent_direct`: "Check and update package.json dependencies"
2. `exec`: "npm install"
3. `exec`: "npm test"
4. Report: "Updated X packages, all Y tests passing"
