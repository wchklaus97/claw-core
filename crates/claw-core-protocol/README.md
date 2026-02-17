# claw-core-protocol

Async Rust client and protocol types for the **claw_core** daemon.

The claw_core daemon provides session-managed terminal execution over a Unix socket (JSON protocol). This crate gives you:

- **Protocol types** — `RpcRequest`, `RpcResponse`, method-specific param/result structs
- **Async client** — `ClawCoreClient` with typed convenience methods

## Quick start

```rust
use claw_core_protocol::{ClawCoreClient, CreateSessionParams, ExecRunParams};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut client = ClawCoreClient::connect("/tmp/trl.sock").await?;

    // Create a session
    let session = client.create_session(CreateSessionParams {
        shell: Some("/bin/zsh".into()),
        working_dir: Some("/tmp".into()),
        ..Default::default()
    }).await?;

    // Run a command
    let result = client.exec_run(ExecRunParams {
        session_id: session.session_id.clone(),
        command: "echo hello from claw_core".into(),
        timeout_s: Some(30),
        stdin: None,
        env: None,
    }).await?;

    println!("exit_code={}, stdout={}", result.exit_code, result.stdout);

    // Clean up
    client.destroy_session(claw_core_protocol::DestroySessionParams {
        session_id: session.session_id,
        force: None,
    }).await?;

    Ok(())
}
```

## With ZeroClaw

ZeroClaw can use this crate via an optional feature flag:

```bash
cargo install zeroclaw --features claw-core
```

Then enable in `~/.zeroclaw/config.toml`:

```toml
[claw_core]
enabled = true
socket_path = "/tmp/trl.sock"
# auto_session = true      # create/destroy session per call (default)
# default_timeout_s = 60   # command timeout (default)
```

This adds a `claw_core_exec` tool that the agent can use for session-managed command execution with timeouts, alongside the built-in `shell` tool.

## Protocol

All communication is **line-delimited JSON over a Unix socket** (default: `/tmp/trl.sock`).

### Methods

| Method | Description |
|--------|-------------|
| `system.ping` | Health check (returns uptime, version) |
| `system.stats` | Runtime statistics |
| `session.create` | Create a terminal session |
| `session.list` | List active sessions |
| `session.info` | Get session details |
| `session.destroy` | Terminate a session |
| `exec.run` | Execute a command (buffered, waits for completion) |

### Error codes

| Code | Meaning |
|------|---------|
| `SESSION_NOT_FOUND` | No session with given ID |
| `SESSION_BUSY` | Session already running a command |
| `COMMAND_TIMEOUT` | Command exceeded timeout |
| `INVALID_PARAMS` | Missing or malformed parameters |
| `INTERNAL_ERROR` | Unexpected runtime error |
| `RESOURCE_PRESSURE` | System under resource pressure |
| `MAX_SESSIONS_REACHED` | Session limit reached |

## Requirements

- The **claw_core daemon** must be running and listening on the configured socket path.
- Start the daemon: `claw_core` (or `./target/release/claw_core`).
- Default socket: `/tmp/trl.sock` (override with `TRL_SOCKET_PATH` env var).

## License

MIT
