# OpenClaw Claw Core Plugin

OpenClaw plugin for the **Claw Core** Terminal Runtime Layer. When installed, claw_core is auto-started with OpenClaw, and agents can use it for session-managed command execution.

## Install

```bash
openclaw plugins install @wchklaus97hk/claw-core
```

Or from a local path (e.g. when developing):

```bash
openclaw plugins install ./plugin
```

Restart the OpenClaw gateway after installing.

### One-command install (binary auto-download)

OpenClaw extracts npm packages without running `npm install`, so postinstall scripts do not run. The **daemon script** (`claw_core_daemon.sh`) compensates: on first `openclaw clawcore start` (or boot hook), if the plugin binary is missing, it auto-downloads from GitHub Releases, configures `openclaw.json`, and installs skills. No manual binary setup needed.

## Prerequisites

**Platform:** Linux and macOS only. Windows is not supported (claw_core uses Unix domain sockets and Unix-only APIs).

1. **claw_core binary** — one of:
   - **Auto-download** (recommended): run `openclaw clawcore start`; the daemon script downloads the binary from GitHub Releases on first run
   - **Download prebuilt** (no Rust needed): [GitHub Releases](https://github.com/wchklaus97/claw-core/releases) — extract and add to PATH or set `binaryPath`
   - `cargo install claw_core` (requires Rust, if on crates.io)
   - Build from source: `cd /path/to/claw && cargo build --release` — then set `sourcePath` in plugin config
   - Set `binaryPath` in plugin config to a prebuilt binary

2. **Python 3** — for `claw_core_exec.py` (used by the exec wrapper)

## Config

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
          "sourcePath": "/path/to/claw",
          "autoStart": true
        }
      }
    }
  }
}
```

- **binaryPath** — path to claw_core binary (optional; falls back to PATH or ~/.cargo/bin)
- **socketPath** — Unix socket path (default `/tmp/trl.sock`)
- **sourcePath** — path to claw repo to build from (optional)
- **autoStart** — start claw_core when gateway starts (default true)

## What the Plugin Provides

1. **Boot hook** — starts claw_core on `gateway:startup` when `autoStart` is true
2. **Skills** — on install, copies all skills to `~/.openclaw/skills/`:
   - claw-core-runtime, claw-core-sessions, claw-core-daemon
   - cron-helper, cursor-agent, cursor-cron-bridge, plans-mode, status-dashboard
3. **CLI** — `openclaw clawcore start|stop|restart|status`
4. **Gateway RPC** — `clawcore.status`
5. **Scripts** (included in plugin, used by skills):
   - `scripts/claw_core_daemon.sh` — start/stop/restart/status; auto-downloads binary on first start if missing (OpenClaw does not run postinstall)
   - `scripts/claw_core_exec.py` — one-shot exec wrapper
   - `scripts/cron_helper.py` — simple cron job creation
   - `scripts/status_dashboard.py` — display sessions, cron jobs, activity
   - `scripts/install-skills-to-openclaw.sh` — copies skills to `~/.openclaw/skills/` (runs on postinstall)

Skills reference `$PLUGIN_ROOT` for script paths (plugin install dir, e.g. `~/.openclaw/extensions/claw-core`).

## Manual Control

```bash
openclaw clawcore status
openclaw clawcore start
openclaw clawcore stop
```

## Developing

From the claw repo:

```bash
openclaw plugins install -l ./plugin
```

This links the plugin (no copy) so edits apply immediately. Restart the gateway after changes.
