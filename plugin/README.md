# OpenClaw Claw Core Plugin

OpenClaw plugin for the **Claw Core** Terminal Runtime Layer. Provides session-managed command execution, **multi-bot Telegram setup**, **PicoClaw integration**, **direct Cursor Agent invocation**, and **image generation via Cursor**.

## Features

| Feature | Description |
|---|---|
| 🦀 **Claw Core Runtime** | Session-managed shell execution with timeouts |
| ⌘ **Cursor Agent Direct** | Invoke Cursor for coding + image gen from Telegram |
| 🐾 **PicoClaw Bridge** | Chat with PicoClaw for quick Q&A and web search |
| 🎨 **Image Generation** | Generate images via Cursor's built-in auto model |
| 🤖 **3-Bot Setup** | One-command setup for artist, assistant, developer bots |
| 📊 **Status Dashboard** | Full-stack status: backends, agents, sessions, cron |

## Install

```bash
openclaw plugins install @wchklaus97hk/claw-core
```

Or from a local path:

```bash
openclaw plugins install ./plugin
```

Restart the OpenClaw gateway after installing.

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

## CLI Commands

```bash
# Claw Core daemon
openclaw clawcore start
openclaw clawcore stop
openclaw clawcore restart
openclaw clawcore status

# Multi-bot setup
openclaw clawcore setup-bots --image-token X --qa-token Y --dev-token Z
openclaw clawcore setup-bots --link-repo developer /path/to/project
openclaw clawcore setup-bots --dry-run

# PicoClaw
openclaw picoclaw status
openclaw picoclaw config
openclaw picoclaw chat "What is Rust?"
```

## Gateway RPC Methods

| Method | Description |
|---|---|
| `clawcore.status` | Claw Core daemon status |
| `picoclaw.status` | PicoClaw installation status |
| `picoclaw.chat` | Send message to PicoClaw |
| `clawcore.bots-status` | All backends and agents status |

## Skills

The plugin provides 13 skills:

| Skill | Description |
|---|---|
| `claw-core-runtime` | Session-managed command execution |
| `claw-core-sessions` | Session list/inspect/destroy |
| `claw-core-daemon` | Daemon start/stop/restart/status |
| `cron-helper` | Simple cron job creation |
| `cursor-agent` | Cursor Agent invocation (direct tool + exec fallback) |
| `cursor-cron-bridge` | Schedule Cursor tasks via cron |
| `plans-mode` | Multi-step planning & execution |
| `status-dashboard` | Full-stack status display |
| `image-via-cursor` | Image generation via Cursor's auto model |
| `picoclaw-bridge` | PicoClaw chat and web search |
| `picoclaw-config` | PicoClaw configuration management |
| `multi-backend-router` | Smart routing between backends |
| `telegram-power-user` | Rich Telegram interaction patterns |

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
- **Cursor CLI** (optional): For `cursor_agent_direct` tool
- **PicoClaw** (optional): For `picoclaw_chat` tool — install from https://github.com/sipeed/picoclaw

## Troubleshooting

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

## Developing

From the claw repo:

```bash
openclaw plugins install -l ./plugin
```

This links the plugin so edits apply immediately. Restart the gateway after changes.

## License

MIT
