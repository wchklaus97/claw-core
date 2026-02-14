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
2. **Action:** Run `postinstall-download-binary.sh` (download binary from GitHub Releases), `postinstall-config-openclaw.js` (set `binaryPath` in `openclaw.json`), and `install-skills-to-openclaw.sh` (copy skills to `~/.openclaw/skills/`).
3. **Then:** Proceed with `find_binary()` and start the daemon.

This ensures a one-command install works: `openclaw plugins install @wchklaus97hk/claw-core` followed by `openclaw clawcore start` completes setup without manual steps.

### OpenClaw Skills

The plugin ships 8 skills (canonical list: `scripts/claw-core-skills.list`):

| Skill | Purpose |
|-------|---------|
| **claw-core-runtime** | Execute commands through claw_core (wrapper around `claw_core_exec.py`) |
| **claw-core-sessions** | List and manage claw_core sessions |
| **claw-core-daemon** | Start/stop/status the daemon from the agent |
| **cron-helper** | Cron job scheduling helpers |
| **cursor-agent** | Cursor agent coordination |
| **cursor-cron-bridge** | Bridge between Cursor and cron |
| **plans-mode** | Planning mode workflow |
| **status-dashboard** | Status dashboard for monitoring |

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

# Remove
./scripts/remove-claw-core-openclaw.sh

# Verify
./scripts/verify_integration.sh
```

Restart the OpenClaw gateway after installing.

## Quick Reference

- **One-command install:** `openclaw plugins install @wchklaus97hk/claw-core` then `openclaw clawcore start`
- **Local install:** `./scripts/install-claw-core-openclaw.sh` (use `--force` to reinstall)
- **Remove:** `./scripts/remove-claw-core-openclaw.sh`
- **Verify:** `./scripts/verify_integration.sh`
- **Start runtime:** `openclaw clawcore start` or daemon script
- **Status:** `openclaw clawcore status`
- **RPC:** `clawcore.status` from the gateway
