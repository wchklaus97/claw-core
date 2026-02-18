# Codex CLI Workflow -- Kilo Code

## What is Codex CLI

Codex CLI (`codex`) is OpenAI's coding agent that runs locally from your terminal. It uses GPT-5.3 Codex (and other GPT-4.1 models) to read, edit, and run code in a workspace.

Install: `npm i -g @openai/codex`
Docs: https://developers.openai.com/codex/cli

## When to Use Codex

Delegate to Codex when:
- The task requires a different model (gpt-5.3-codex, gpt-4.1) than the active session
- The user explicitly asks to "use Codex" or "run with Codex"
- The task is large or multi-file and benefits from Codex's full-context understanding
- You want a second opinion or parallel workstream via `codex exec`

Do NOT use Codex when:
- A simple answer or small edit can be done directly
- The task is pure Q&A — use `claw-assistant` mode instead
- Codex is not installed or authenticated

## Non-Interactive Execution

Always use `codex exec` for automation. Never run `codex` without `exec` (opens a TUI).

```bash
# Execute a task
codex exec "Add error handling to src/auth.ts" --json --cd /path/to/workspace

# Plan before executing
codex exec "Refactor the database layer" --plan --json --cd /path/to/workspace

# Read-only analysis (suggest approval mode)
codex exec "Explain what parseConfig does" --approval suggest --json --cd /path/to/workspace
```

## Mode Reference

| Mode | Flag | Approval | Use when |
|---|---|---|---|
| agent | (none) | auto | Default: implement, fix, refactor |
| plan | `--plan` | auto | User asks to plan first; large ambiguous tasks |
| ask | `--approval suggest` | suggest | Read-only: explain, analyse, explore |

## Model Selection

```bash
codex exec "..." --model gpt-4.1-mini   # fast, default
codex exec "..." --model gpt-4.1        # more capable
codex exec "..." --model gpt-5.3-codex  # maximum (requires Pro auth)
```

## Project Config

`.codex/config.toml` at the repo root sets project defaults:
- `model = "gpt-4.1-mini"` — default model
- `approval_policy = "on-request"` — Codex asks before running commands
- `sandbox_mode = "workspace-write"` — read/write within working directory
- `web_search = "cached"` — uses OpenAI's web cache

Override on the command line:
```bash
codex exec "..." --model gpt-4.1 --approval auto --cd /workspace
```

## Session Resuming

```bash
codex exec resume --last "Continue implementing the plan"
codex exec resume <session-id> "Fix the failing test"
```

## Checking Installation

```bash
codex --version
python3 plugin/scripts/codex_agent_direct.py --check
```

## Constraints

- Do NOT pass API keys or secrets in the prompt
- Do NOT use `codex` interactively in automation scripts (hangs)
- Do NOT use `--approval danger-full-access` without explicit user consent
- Codex operates within the workspace sandbox by default
