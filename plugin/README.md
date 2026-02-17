# OpenClaw Claw Core Plugin

[简体中文](README-zh-Hans.md) | [繁體中文](README-zh-Hant.md)

OpenClaw plugin for the **Claw Core** Terminal Runtime Layer. Provides session-managed command execution, **multi-bot Telegram setup**, **PicoClaw integration**, **direct Cursor Agent invocation**, **image generation via Cursor**, and a **Cursor agent workspace** with shared_memory and shared_skills.

## Features

| Feature | Description |
|---|---|
| 🦀 **Claw Core Runtime** | Session-managed shell execution with timeouts |
| ⌘ **Cursor Agent Direct** | Invoke Cursor for coding + image gen from Telegram |
| 🐾 **PicoClaw Bridge** | Chat with PicoClaw for quick Q&A and web search |
| 🎨 **Image Generation** | Generate images via Cursor's built-in auto model |
| 🤖 **3-Bot Setup** | One-command setup for artist, assistant, developer bots |
| 🤝 **Agent Teams** | Multi-agent collaboration with shared task boards |
| 📊 **Status Dashboard** | Full-stack status: backends, agents, teams, cron |
| 📁 **Agent Workspace** | shared_memory + shared_skills at ~/Documents/claw_core |

**Compatibility:** See [Compatibility](#compatibility) for OpenClaw and Cursor CLI versions.

## Install

```bash
openclaw plugins install @wchklaus97hk/claw-core
```

Or from a local path:

```bash
openclaw plugins install ./plugin
```

Restart the OpenClaw gateway after installing.

### One-command install (binary auto-download)

OpenClaw extracts npm packages without running `npm install`, so postinstall scripts do not run. The **daemon script** (`claw_core_daemon.sh`) compensates: on first `openclaw clawcore start` (or boot hook), if the plugin binary is missing, it auto-downloads from GitHub Releases, configures `openclaw.json`, and installs skills. No manual binary setup needed.

## Quick Start: Three-Bot Setup

Create 3 specialized Telegram bots, each with its own personality and tools:

### Step 1: Create Bots in @BotFather

Open [@BotFather](https://t.me/BotFather) in Telegram and create 3 bots:
1. **Image Bot** (e.g., `@YourArtistBot`) — image generation & design
2. **Q&A Bot** (e.g., `@YourAssistantBot`) — questions & web search
3. **Dev Bot** (e.g., `@YourDevBot`) — coding & DevOps

### Step 2: Run Setup

```bash
openclaw clawcore setup-bots \
  --image-token "123456789:AAA..." \
  --qa-token    "987654321:BBB..." \
  --dev-token   "555555555:CCC..." \
  --dev-repo    /path/to/my-project
```

This creates:
- 3 agent workspaces with personality templates (`SOUL.md`, `IDENTITY.md`, `AGENTS.md`)
- Telegram accounts with routing bindings
- Per-agent tool profiles

### Step 3: Restart Gateway

```bash
openclaw gateway restart
```

### Step 4: Chat!

- **@YourArtistBot**: "Generate a logo for my app, minimal blue design"
- **@YourAssistantBot**: "What's the latest version of Node.js?"
- **@YourDevBot**: "Add dark mode to the settings page"

## Compatibility

| Dependency | Tested version |
|------------|----------------|
| **OpenClaw** | 2026.2.13 (use `openclaw update` for latest) |
| **Cursor CLI** | Cursor IDE 2.5.11 — includes `agent` and `cursor agent` |

Cursor integration prefers `agent` when on PATH, otherwise `cursor agent`. Both require `--output-format stream-json` for non-interactive use.

## Agent Teams — Multi-Agent Collaboration

Inspired by Claude Code Agent Teams — your 3 bots collaborate in a **Telegram group chat** with a shared task board.

### Quick Start: Team Session

```bash
# 1. Create a team
openclaw clawcore team create --name "project-alpha" --group-id -100123456 --repo /path/to/project

# 2. Configure Telegram group (broadcast mode + optional forum topics)
openclaw clawcore team setup-telegram --name "project-alpha" --group-id -100123456

# 3. Or do it all at once during bot setup
openclaw clawcore setup-bots \
  --image-token X --qa-token Y --dev-token Z \
  --team-group -100123456 --team-name "project-alpha"
```

### How It Works

```
Group: "Project Alpha Team"
  Human:      "@ClawDevBot build the landing page"
  Developer:  "On it! Creating tasks...
               📋 T001: Hero image → @ClawArtistBot
               📋 T002: CSS research → @ClawAssistantBot
               📋 T003: Implementation → me"
  Artist:     "✅ T001 done! assets/hero-banner.png"
  Assistant:  "✅ T002 done! Recommend Tailwind v4"
  Developer:  "✅ T003 done! PR #42 ready."
```

### Team Tool

Agents use `team_coordinate` to manage the shared task board:

```
team_coordinate(action: "create_task", team: "project-alpha",
                title: "Design hero banner", assign_to: "artist")

team_coordinate(action: "get_tasks", team: "project-alpha")

team_coordinate(action: "message_teammate", team: "project-alpha",
                agent: "developer", to: "artist", body: "Need hero image")
```

### Telegram Group Structure

| Topic | Primary Agent | Purpose |
|---|---|---|
| 📋 General | All (broadcast) | Coordination, status updates |
| 🎨 Design | artist | Visual tasks |
| 💬 Research | assistant | Q&A, web search |
| 🛠️ Code | developer | Coding, builds |

Configure with forum topics for best organization, or use a simple group with @mentions.

### Team CLI

```bash
openclaw clawcore team create --name X --group-id Y --repo Z
openclaw clawcore team status --name X
openclaw clawcore team list
openclaw clawcore team close --name X
openclaw clawcore team task-add --name X --title "Task" --assign-to developer
openclaw clawcore team task-list --name X
openclaw clawcore team setup-telegram --name X --group-id Y
```

---

## The Three Bots

### 🎨 Artist Bot

| Property | Value |
|---|---|
| Agent ID | `artist` |
| Tool Profile | `minimal` |
| Tools | `cursor_agent_direct`, `image`, `read`, `write` |
| Backend | Cursor Agent (auto model → image generation) |
| Personality | Creative, enthusiastic, detail-oriented |

The artist uses Cursor's built-in image generation — no third-party API keys needed.

### 💬 Assistant Bot

| Property | Value |
|---|---|
| Agent ID | `assistant` |
| Tool Profile | `messaging` |
| Tools | `picoclaw_chat`, `picoclaw_config`, `web_search`, `web_fetch`, `read` |
| Backend | PicoClaw (ultra-lightweight AI assistant) |
| Personality | Friendly, efficient, concise |

Requires [PicoClaw](https://github.com/sipeed/picoclaw) installed.

### 🛠️ Developer Bot

| Property | Value |
|---|---|
| Agent ID | `developer` |
| Tool Profile | `full` |
| Tools | All — `cursor_agent_direct`, `exec`, `bash`, `read`, `write`, `edit`, `cron`, `picoclaw_chat`, etc. |
| Backend | Cursor Agent + Claw Core + PicoClaw |
| Personality | Methodical, precise, pragmatic |

The most versatile bot — can code, exec, generate images, search, and schedule.

## Agent Tools

The plugin registers these agent tools (via `api.registerTool()`):

### `cursor_agent_direct`

Invoke Cursor Agent directly for coding, image generation, and complex tasks.

```
cursor_agent_direct(prompt: "Add error handling to the login function", workspace: "/my/project")
```

- Auto model selection (including image generation)
- Structured JSON output with file detection
- Timeout: 600s default (configurable)

### `picoclaw_chat`

Chat with PicoClaw for quick questions and web search.

```
picoclaw_chat(message: "What is the latest stable Rust version?")
```

- Built-in web search via PicoClaw
- Multiple LLM providers supported

### `picoclaw_config`

View or update PicoClaw configuration.

```
picoclaw_config(action: "view")
picoclaw_config(action: "set", key: "model", value: "deepseek-chat")
```

### `team_coordinate`

Manage agent team sessions — shared task board and inter-agent messaging.

```
team_coordinate(action: "create_task", team: "my-team", title: "Build feature", assign_to: "developer")
team_coordinate(action: "get_tasks", team: "my-team")
team_coordinate(action: "message_teammate", team: "my-team", agent: "developer", to: "artist", body: "Need icon")
```

Actions: `create_task`, `claim_task`, `update_task`, `get_tasks`, `message_teammate`, `get_messages`, `team_status`

## CLI Commands

```bash
# Claw Core daemon
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore restart
openclaw clawcore status

# Cursor integration & workspace
openclaw clawcore setup-cursor
openclaw clawcore setup-cursor --workspace /path/to/project
openclaw clawcore init-workspace
openclaw clawcore reset-workspace
openclaw clawcore teardown

# Multi-bot setup
openclaw clawcore setup-bots --image-token X --qa-token Y --dev-token Z
openclaw clawcore setup-bots --link-repo developer /path/to/project
openclaw clawcore setup-bots --dry-run

# PicoClaw
openclaw picoclaw status
openclaw picoclaw config
openclaw picoclaw chat "What is Rust?"

# Agent Teams
openclaw clawcore team create --name my-team --group-id -100123456 --repo /path/to/project
openclaw clawcore team status --name my-team
openclaw clawcore team list
openclaw clawcore team close --name my-team
openclaw clawcore team task-add --name my-team --title "Build feature" --assign-to developer
openclaw clawcore team task-list --name my-team
openclaw clawcore team setup-telegram --name my-team --group-id -100123456
```

## Cursor CLI Integration

The plugin can configure OpenClaw to delegate tasks to Cursor CLI:

```bash
# Set up Cursor integration (adds cliBackends, cursor-dev agent, allowAgents, workspace)
openclaw clawcore setup-cursor

# With a custom workspace
openclaw clawcore setup-cursor --workspace /path/to/project

# Restart gateway to apply
openclaw gateway restart
```

This is also run automatically on first `openclaw clawcore start` (when binary is downloaded).

Or ask the agent in chat: "Set up Cursor integration".

## Gateway RPC Methods

| Method | Description |
|---|---|
| `clawcore.status` | Claw Core daemon status |
| `picoclaw.status` | PicoClaw installation status |
| `picoclaw.chat` | Send message to PicoClaw |
| `clawcore.bots-status` | All backends and agents status |
| `clawcore.team-create` | Create a new team session |
| `clawcore.team-status` | Get team status with task board |
| `clawcore.team-list` | List all teams |

## What the Plugin Provides

The plugin provides 17 skills:

| Skill | Description |
|---|---|
| `claw-core-runtime` | Session-managed command execution |
| `claw-core-sessions` | Session list/inspect/destroy |
| `claw-core-daemon` | Daemon start/stop/restart/status |
| `cron-helper` | Simple cron job creation |
| `cursor-agent` | Cursor Agent invocation (direct tool + exec fallback) |
| `cursor-cron-bridge` | Schedule Cursor tasks via cron |
| `cursor-setup` | Configure Cursor CLI integration in openclaw.json |
| `plans-mode` | Multi-step planning & execution |
| `status-dashboard` | Full-stack status display |
| `image-via-cursor` | Image generation via Cursor's auto model |
| `picoclaw-bridge` | PicoClaw chat and web search |
| `picoclaw-config` | PicoClaw configuration management |
| `multi-backend-router` | Smart routing between backends |
| `telegram-power-user` | Rich Telegram interaction patterns |
| `team-lead` | Coordinate agent team sessions |
| `team-member` | Participate in team sessions |
| `team-telegram-group` | Telegram group team communication |

Skills reference `$PLUGIN_ROOT` for script paths (plugin install dir, e.g. `~/.openclaw/extensions/claw-core`).

Ask the agent: "Install claw core" or "Remove claw core" — the claw-core-install and claw-core-remove skills run the full steps.

## Configuration

Add to `~/.openclaw/openclaw.json` under `plugins.entries.claw-core`:

```json
{
  "plugins": {
    "entries": {
      "claw-core": {
        "enabled": true,
        "config": {
          "socketPath": "/tmp/trl.sock",
          "binaryPath": "/path/to/claw_core",
          "autoStart": true,
          "picoClawPath": "picoclaw",
          "cursorPath": "cursor",
          "cursorTimeout": "600",
          "defaultWorkspace": "/path/to/project",
          "enablePicoClaw": true,
          "enableCursorDirect": true
        }
      }
    }
  }
}
```

| Field | Default | Description |
|---|---|---|
| `socketPath` | `/tmp/trl.sock` | Claw Core Unix socket path |
| `binaryPath` | auto-detect | Path to claw_core binary |
| `sourcePath` | — | Path to claw repo (build from source) |
| `autoStart` | `true` | Start daemon on gateway boot |
| `picoClawPath` | `picoclaw` | PicoClaw binary path |
| `cursorPath` | `cursor` | Cursor CLI path |
| `cursorTimeout` | `600` | Cursor Agent timeout (seconds) |
| `defaultWorkspace` | — | Default workspace for operations |
| `enablePicoClaw` | `true` | Enable PicoClaw tools |
| `enableCursorDirect` | `true` | Enable Cursor Agent tool |

## Prerequisites

- **Platform**: Linux and macOS only (Windows not supported)
- **Python 3**: For scripts (`claw_core_exec.py`, `picoclaw_client.py`, etc.)
- **Claw Core binary**: Auto-downloads on first start, or install manually
- **Cursor CLI** (optional): For `cursor_agent_direct` tool — `agent` or `cursor` on PATH
- **PicoClaw** (optional): For `picoclaw_chat` tool — install from https://github.com/sipeed/picoclaw

## Troubleshooting

- **`agentId is not allowed for sessions_spawn`**: run `openclaw clawcore setup-cursor`, then `openclaw gateway restart`.
- **`agent` / `cursor` not found**: install Cursor CLI and ensure `agent` or `cursor` is on PATH.
- **Config validation errors**: run `openclaw doctor --fix`, then rerun `openclaw clawcore setup-cursor`.

### PicoClaw not found
```
⚠ picoclaw_chat tool not registered: picoclaw not found
```
Install PicoClaw: https://github.com/sipeed/picoclaw

### Cursor CLI not found
```
⚠ cursor_agent_direct tool not registered: cursor not found
```
Install Cursor and ensure `cursor` is on PATH.

### Bot tokens not set
```
⚠ needs token
```
Create bots via @BotFather and re-run `setup-bots` with tokens.

### Claw Core not running
```
✗ Claw Core NOT RUNNING
```
Start the daemon: `openclaw clawcore start`

## Manual Control

```bash
openclaw clawcore status
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore teardown   # stop + clean config; then: rm -rf ~/.openclaw/extensions/claw-core
```

## Developing

From the claw repo:

```bash
openclaw plugins install -l ./plugin
```

This links the plugin so edits apply immediately. Restart the gateway after changes.

## License

MIT
