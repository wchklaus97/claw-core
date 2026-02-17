# OpenClaw Integration

How `claw_core` integrates with OpenClaw for automatic startup and managed command execution.

**Documentation:** [https://wchklaus97.github.io/claw-core/en/book/](https://wchklaus97.github.io/claw-core/en/book/)

**Path placeholders:** `$CLAW_ROOT` = claw repo, `$WORKSPACE` = OpenClaw workspace, `$PLUGIN_ROOT` = plugin install dir.

## Overview

**claw_core** is a Rust-based Terminal Runtime Layer. **OpenClaw** is an AI agent framework. This integration allows OpenClaw to:

1. **Auto-start claw_core** when the gateway starts (via boot hook)
2. **Prefer claw_core** for command execution when available
3. **Manage claw_core** lifecycle via skills
4. **Fall back gracefully** to normal exec if claw_core is unavailable

## Plugin features and functions (v0.1.6)

The claw-core plugin provides the following.

### CLI commands

| Command | Purpose |
|---------|---------|
| `openclaw clawcore start \| stop \| restart \| status` | Daemon lifecycle |
| `openclaw clawcore setup-cursor` | Configure Cursor CLI and create workspace |
| `openclaw clawcore init-workspace` | Create workspace with shared_memory, shared_skills, generated/ |
| `openclaw clawcore reset-workspace` | Reset workspace (backs up shared_memory) |
| `openclaw clawcore setup-bots` | One-command setup for 3 Telegram bots (artist, assistant, developer) |
| `openclaw clawcore team` | Agent teams: create, setup-telegram, list |
| `openclaw clawcore teardown` | Stop daemon and clean up |
| `openclaw picoclaw status \| config \| chat "<msg>"` | PicoClaw (optional) |

### Agent tools

| Tool | Purpose |
|------|---------|
| `cursor_agent_direct` | Invoke Cursor Agent for coding and image generation; outputs go to workspace `generated/images/` and can be routed back to the requesting platform (e.g. Telegram) |
| `picoclaw_chat` | Send messages to PicoClaw for quick Q&A and web search (optional; not yet tested) |
| `picoclaw_config` | View or set PicoClaw config (optional; not yet tested) |
| `team_coordinate` | Manage team task board and coordination |

### Workspace and multi-bot

- **Default workspace:** `~/Documents/claw_core` (or custom via `defaultWorkspace` and `--workspace`).
- **Workspace layout:** `shared_memory/`, `shared_skills/`, `projects/`, `generated/images/`, `generated/exports/`.
- **Per-agent workspaces:** Telegram bots use `~/.openclaw/workspace-{bot_id}/`; workspace can be resolved per agent or passed explicitly to tools.
- **Image generation:** Cursor-generated images are stored under `generated/images/` and are auto-detected and routed back to the requesting platform (Telegram, webhook, etc.).

### Agent teams

- Multi-agent collaboration with a shared task board.
- Telegram group setup via `openclaw clawcore team setup-telegram`.
- Tools and skills: `team_coordinate`, team-lead, team-member, team-telegram-group.

## Architecture

```
┌────────────────────────────────────────┐
│  OpenClaw Gateway (Node.js)            │
└────────────┬───────────────────────────┘
             │ 1. gateway:startup event
             ↓
┌────────────────────────────────────────┐
│  Boot hook (boot-claw-core)            │
│  - Runs on gateway startup             │
│  - Starts claw_core daemon             │
└────────────┬───────────────────────────┘
             │ 2. start daemon
             ↓
┌────────────────────────────────────────┐
│  claw_core (Rust daemon)               │
│  - Listens on /tmp/trl.sock            │
│  - Manages terminal sessions           │
└────────────┬───────────────────────────┘
             │ 3. exec commands via socket
             ↓
┌────────────────────────────────────────┐
│  OpenClaw Skills                       │
│  - claw-core-runtime (exec wrapper)    │
│  - claw-core-sessions (list/manage)    │
│  - claw-core-daemon (start/stop)       │
└────────────────────────────────────────┘
```

## Components

### Boot Hook

**Location:** Plugin hook `boot-claw-core` (or `$WORKSPACE/BOOT.md`)

Runs on `gateway:startup` and starts claw_core via the daemon script.

### Daemon Management Script

**Location:** `$PLUGIN_ROOT/scripts/claw_core_daemon.sh` or `$CLAW_ROOT/scripts/claw_core_daemon.sh`

```bash
./claw_core_daemon.sh start   # Start
./claw_core_daemon.sh stop    # Stop
./claw_core_daemon.sh restart # Restart
./claw_core_daemon.sh status  # Check status
```

- PID: `/tmp/claw_core.pid`
- Log: `/tmp/claw_core.log`
- Socket: `/tmp/trl.sock` (or `$CLAW_CORE_SOCKET`)

**Auto-download binary:** OpenClaw extracts npm packages without running `npm install`, so postinstall scripts do not run. The daemon script compensates: on first `start`, if the plugin binary is missing (and `CLAW_CORE_BINARY` / `CLAW_CORE_SOURCE` are unset), it downloads the binary from GitHub Releases, configures `openclaw.json`, and installs skills. One-command install: `openclaw plugins install @wchklaus97hk/claw-core` then `openclaw clawcore start`.

### Implementation: Daemon auto-download

**Problem:** OpenClaw installs plugins by extracting the npm tarball directly; it does not run `npm install` in the extracted directory. As a result, `postinstall` scripts (binary download, config, skills) never execute.

**Solution:** The daemon script (`claw_core_daemon.sh`) runs the missing setup when `start` is invoked and the plugin binary is absent. In `start()`:

1. **Condition:** `CLAW_CORE_BINARY` and `CLAW_CORE_SOURCE` are unset, and `$PLUGIN_ROOT/bin/claw_core` does not exist.
2. **Action:** Run `postinstall-download-binary.sh` (download binary from GitHub Releases), `postinstall-config-openclaw.js` (set `binaryPath` in `openclaw.json`), `install-skills-to-openclaw.sh` (copy skills to `~/.openclaw/skills/`), and `setup-cursor-integration.js` (configure Cursor integration in `openclaw.json`).
3. **Then:** Proceed with `find_binary()` and start the daemon.

This ensures a one-command install works: `openclaw plugins install @wchklaus97hk/claw-core` followed by `openclaw clawcore start` completes setup without manual steps.

### OpenClaw Skills

The plugin ships 12+ skills (canonical list: `scripts/claw-core-skills.list`):

| Skill | Purpose |
|-------|---------|
| **claw-core-runtime** | Execute commands through claw_core (wrapper around `claw_core_exec.py`) |
| **claw-core-sessions** | List and manage claw_core sessions |
| **claw-core-daemon** | Start/stop/status the daemon from the agent |
| **claw-core-install** | Run full install or setup completion (plugins install, daemon start, Cursor setup) |
| **claw-core-remove** | Run full removal (stop daemon, clean config, remove skills and plugin) |
| **cron-helper** | Cron job scheduling helpers |
| **cursor-agent** | Cursor agent coordination |
| **cursor-cron-bridge** | Bridge between Cursor and cron |
| **plans-mode** | Planning mode workflow |
| **status-dashboard** | Status dashboard for monitoring |
| **cursor-setup** | Configure Cursor CLI integration in `openclaw.json` |
| **claw-core-workspace** | How to work within the claw_core workspace (read WORKSPACE.md, use shared_memory, shared_skills) |

### Install / Remove

**One-command install (npm):**

```bash
openclaw plugins install @wchklaus97hk/claw-core
openclaw clawcore start   # daemon auto-downloads binary on first run
```

**Local/development install (builds binary, installs plugin, auto-configures openclaw.json):**

```bash
# Install
./scripts/install-claw-core-openclaw.sh

# Reinstall
./scripts/install-claw-core-openclaw.sh --force

# Remove (also cleans Cursor integration from openclaw.json)
./scripts/remove-claw-core-openclaw.sh

# Verify
./scripts/verify_integration.sh
```

Restart the OpenClaw gateway after installing.

## Cursor CLI Integration

The plugin can configure OpenClaw to delegate tasks to Cursor CLI. This adds:

- **cliBackends**: `cursor-cli`, `cursor-plan`, `cursor-ask` (Agent, Plan, Ask modes)
- **cursor-dev agent**: Uses `cursor-cli/auto` as model
- **subagents.allowAgents**: Allows main agent to spawn sub-agents under cursor-dev

**Why this is needed:** OpenClaw installs plugins by extracting the npm tarball without running `npm install`, so postinstall never runs. The daemon script runs `setup-cursor-integration.js` on first start to compensate. If auto-setup was skipped or you need to reconfigure, use the manual steps below.

### Step-by-step setup

1. **Install the plugin:** `openclaw plugins install @wchklaus97hk/claw-core`
2. **Start daemon (auto-setup):** `openclaw clawcore start` — on first run this downloads the binary and configures Cursor in `openclaw.json`
3. **Optional manual setup:** If Cursor integration is missing or needs a different workspace: `openclaw clawcore setup-cursor` (or `--workspace /path/to/project`)
4. **Restart gateway:** `openclaw gateway restart`

### Workspace structure

When you run `openclaw clawcore setup-cursor`, it creates and configures a **workspace** where the Cursor agent operates. The default is `~/Documents/claw_core`.

| Path | Purpose |
|------|---------|
| `shared_memory/` | Daily logs (`YYYY-MM-DD.md`), long-term notes, topic files — persistent context across sessions |
| `shared_skills/` | Skills available to all agents (superpowers workflows, claw-core-workspace, model-selection-agent, etc.) |
| `projects/` | Symlinks or clones of external repos — work inside `projects/repo-name/` while staying in the workspace |
| `generated/images/` | Cursor-generated images — auto-detected and routed back to the requesting platform (Telegram, webhook, etc.) |
| `generated/exports/` | Other generated artifacts |

`setup-cursor` calls `init-workspace.js`, which copies `WORKSPACE.md` and `.gitignore`, and installs default skills from `default-skills.json` into `shared_skills/`. For power users: run `node $PLUGIN_ROOT/scripts/init-workspace.js init` (or `reset`) to reinitialize or reset the workspace.

### Dependencies

- **Cursor CLI** on PATH (`agent` or `cursor` — setup prefers `agent` when available)
- **Cursor login:** `agent login` or `cursor agent login` or set `CURSOR_API_KEY`

### Automatic Setup (first start)

When `openclaw clawcore start` runs the first-time setup (binary download), it also runs `setup-cursor-integration.js` automatically.

### Manual Setup

```bash
# One-liner: setup Cursor and restart gateway
openclaw clawcore setup-cursor && openclaw gateway restart

# Setup with default workspace
openclaw clawcore setup-cursor

# Setup with custom workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# Then restart gateway
openclaw gateway restart
```

### Via Agent Chat

Ask the agent: "Set up Cursor integration" or "設定 Cursor 整合". The agent uses the `cursor-setup` skill.

### What Gets Added to openclaw.json

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/Documents/claw_core",
      "cliBackends": {
        "cursor-cli": {
          "command": "agent",
          "args": ["--print", "--output-format", "stream-json", "--workspace", "..."]
        }
      }
    },
    "list": [
      { "id": "main", "default": true, "subagents": { "allowAgents": ["*"] } },
      { "id": "cursor-dev", "model": { "primary": "cursor-cli/auto" } }
    ]
  }
}
```

### Troubleshooting

- **`agentId is not allowed for sessions_spawn`**: run `openclaw clawcore setup-cursor`, then `openclaw gateway restart`
- **`agent` / `cursor` not found**: install Cursor CLI and ensure `agent` or `cursor` is on PATH
- **Config schema errors**: run `openclaw doctor --fix`, then rerun `openclaw clawcore setup-cursor`

## PicoClaw (optional, not yet tested)

The plugin (v0.1.6) can integrate with [PicoClaw](https://github.com/sipeed/picoclaw), an ultra-lightweight AI assistant, for quick Q&A and web search.

- **Tools:** `picoclaw_chat` (send messages), `picoclaw_config` (view/set model, provider, language)
- **CLI:** `openclaw picoclaw status | config | chat "<message>"`
- **Config:** Set `picoClawPath` and `enablePicoClaw: true` in the plugin config if you install PicoClaw.

**Note:** PicoClaw integration has **not been tested yet**. It is provided as optional functionality. Install PicoClaw from https://github.com/sipeed/picoclaw if you want to try it.

## Quick Reference

- **One-command install:** `openclaw plugins install @wchklaus97hk/claw-core` then `openclaw clawcore start`
- **Local install:** `./scripts/install-claw-core-openclaw.sh` (use `--force` to reinstall)
- **Remove:** `./scripts/remove-claw-core-openclaw.sh`
- **Verify:** `./scripts/verify_integration.sh`
- **Start runtime:** `openclaw clawcore start` or daemon script
- **Status:** `openclaw clawcore status`
- **Setup Cursor:** `openclaw clawcore setup-cursor`
- **RPC:** `clawcore.status` from the gateway
