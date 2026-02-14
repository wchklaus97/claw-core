# OpenClaw Integration

How `claw_core` integrates with OpenClaw for automatic startup and managed command execution.

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

```bash
# Install (builds binary, installs plugin, auto-configures openclaw.json)
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

- **Install:** `./scripts/install-claw-core-openclaw.sh` (use `--force` to reinstall)
- **Remove:** `./scripts/remove-claw-core-openclaw.sh`
- **Verify:** `./scripts/verify_integration.sh`
- **Start runtime:** `openclaw clawcore start` or daemon script
- **Status:** `openclaw clawcore status`
- **RPC:** `clawcore.status` from the gateway
