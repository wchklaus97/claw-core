# Cursor CLI Modes — Testing with OpenClaw

This document describes how to test Cursor CLI modes (**agent**, **plan**, **ask**) when using the claw-core plugin with OpenClaw, and the expected behavior for each mode.

## Prerequisites

- **Cursor CLI** on PATH: `agent` or `cursor` (run `python3 plugin/scripts/cursor_agent_direct.py --check` to verify).
- **OpenClaw**: `openclaw clawcore setup-cursor` completed, gateway running.
- **cursor_agent_direct** tool available (plugin installed, `enableCursorDirect` not disabled).

## Test matrix

| Mode  | Purpose              | Example prompt (short)                       | Expected behavior / result |
| ----- | -------------------- | ------------------------------------------- | -------------------------- |
| agent | Execute changes      | "Add a TODO comment at top of README.md"     | File changed; `files_created` may list it; `ok: true` and output show completion. |
| plan  | Plan then execute    | "Refactor module X to use async"             | Output includes planning/research first, then execution; may be longer; `ok: true` and possibly `files_created`. |
| ask   | Read-only            | "What does function parseConfig do?"         | Output is explanation only; no file changes; `files_created` empty; `ok: true`. |

## Telegram test messages

After `openclaw clawcore setup-bots` and gateway restart, use these in Telegram to test each bot and Cursor modes. Replace `@YourDevBot` etc. with your bot usernames.

| Bot | Message to send | What it tests |
| ----- | ----------------- | -------------- |
| **Developer** | `Use Cursor in ask mode: in one sentence, what does the README in this workspace describe?` | Cursor **ask** mode (read-only). |
| **Developer** | `Use Cursor in plan mode to add a one-line TODO at the top of README.md` | Cursor **plan** mode (plan then execute). |
| **Developer** | `Use Cursor: add a one-line TODO comment at the top of README.md` | Cursor **agent** mode (default execute). |
| **Artist** | `Use Cursor in ask mode: list the file extensions in the workspace` | Artist bot + Cursor ask (read-only). |
| **Assistant** | `What is the latest LTS version of Node.js?` | PicoClaw / Q&A (no Cursor). |

Expect Developer/Artist to call `cursor_agent_direct` with the right `mode` when you say "ask mode" or "plan mode"; agent mode is default when you don’t specify.

### Other actions (create project, exec, team)

Use these to test project creation, shell execution, and team coordination. Replace team name and bot usernames as needed.

| Bot | Message to send | What it tests |
| ----- | ----------------- | -------------- |
| **Developer** | `Use Cursor: create a small Python project in the workspace — a single main.py that prints "Hello" and a README. Nothing else.` | Cursor **agent**: scaffold a minimal project. |
| **Developer** | `Use Cursor in plan mode: create a tiny Node project with package.json and index.js that logs "Hi".` | Cursor **plan** + project creation. |
| **Developer** | `Run a command in the workspace: list files with ls -la and tell me the first 3 lines.` | Claw Core **exec** (shell). |
| **Developer** | `Create a task for the artist: "Design a logo for the app". Assign it to the artist. Team name is project-alpha.` | **team_coordinate** (create_task, assign_to artist). |
| **Developer** | `Show me the current tasks for team project-alpha.` | **team_coordinate** (get_tasks). |
| **Artist** | `Check my assigned tasks in team project-alpha and tell me the first one.` | Artist + **team_coordinate** (get_tasks). |
| **Assistant** | `Search the web: what is the current stable Node.js version?` | PicoClaw **web search** (if available). |

For team messages you must have run `openclaw clawcore team create --name project-alpha --group-id YOUR_GROUP_ID --repo /path/to/repo` (and optionally `team setup-telegram`) so the team exists.

## How to run tests

### Via OpenClaw chat

- Ask the agent to use a specific mode, e.g. "Use Cursor in plan mode to refactor …" or "Use Cursor in ask mode to explain what function X does."
- Verify the tool is called with the intended `mode` (agent, plan, or ask). Response content and any listed files should match the table above.

### Via CLI (direct script)

From the claw repo (or with `$PLUGIN_ROOT` pointing to the plugin):

```bash
# Agent mode (default)
python3 plugin/scripts/cursor_agent_direct.py --prompt "Add a TODO at top of README.md" --workspace /path/to/project

# Plan mode
python3 plugin/scripts/cursor_agent_direct.py --prompt "Refactor src/foo to use async" --mode plan --workspace /path/to/project

# Ask mode
python3 plugin/scripts/cursor_agent_direct.py --prompt "What does parseConfig do in src/config.ts?" --mode ask --workspace /path/to/project
```

Inspect the JSON output for `ok`, `output`, `files_created`, and `exit_code`.

## Example output shape (by mode)

All modes return the same JSON structure. Differences are in content and `files_created`.

### agent

- **output**: Cursor’s reply plus any command/edit summary.
- **files_created**: Often non-empty when Cursor created or edited files (e.g. README.md, new or modified code files).
- **ok**: `true` when Cursor exited successfully.

```json
{
  "ok": true,
  "output": "...",
  "exit_code": 0,
  "duration_ms": 12000,
  "files_created": ["/path/to/project/README.md"],
  "truncated": false
}
```

### plan

- **output**: Longer; typically includes a planning/research phase (and possibly clarifying questions) followed by execution summary.
- **files_created**: May be non-empty if the plan led to edits.
- **ok**: `true` when the run completed successfully.

```json
{
  "ok": true,
  "output": "[Planning phase] ... [Execution] ...",
  "exit_code": 0,
  "duration_ms": 45000,
  "files_created": ["/path/to/project/src/foo.ts"],
  "truncated": false
}
```

### ask

- **output**: Explanation or analysis only; no edit steps.
- **files_created**: Should be empty (read-only).
- **ok**: `true` when Cursor answered without error.

```json
{
  "ok": true,
  "output": "The function parseConfig ...",
  "exit_code": 0,
  "duration_ms": 5000,
  "files_created": [],
  "truncated": false
}
```

## References

- Cursor CLI parameters: [cursor.com/docs/cli/reference/parameters](https://cursor.com/docs/cli/reference/parameters)
- Plugin skill: `plugin/skills/cursor-agent/SKILL.md` (modes and when to use each)
- Book: `book/src/openclaw-integration.md` (agent tools and mode summary)
