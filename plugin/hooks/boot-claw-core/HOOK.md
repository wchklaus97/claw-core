---
name: boot-claw-core
description: "Start claw_core daemon when OpenClaw gateway starts (plugin: claw-core)"
metadata:
  openclaw:
    emoji: "🦀"
    events: ["gateway:startup"]
    requires:
      bins: ["bash"]
---

# Boot Claw Core

Runs on `gateway:startup` to start the claw_core Terminal Runtime Layer daemon.

When the claw-core plugin is enabled and `autoStart` is true, this hook starts
claw_core in the background so OpenClaw agents can use it for session-managed
command execution.

## Requirements

- `bash`
- claw_core binary (in PATH, ~/.cargo/bin, or configured via plugin config)

## Configuration

Configure via `plugins.entries.claw-core.config` in openclaw.json:
- `binaryPath`: path to claw_core binary
- `socketPath`: Unix socket path (default `/tmp/trl.sock`)
- `sourcePath`: path to claw repo to build from
- `autoStart`: if false, this hook does nothing
