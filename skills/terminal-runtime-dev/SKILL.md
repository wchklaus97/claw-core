# SKILL.md — Terminal Runtime Development

> Build and maintain the Rust-based Terminal Lightweight Runtime Layer (TRL) that agents use as their execution environment.

---

## What This Skill Is For

You're building `terminal-runtime` — a Rust binary that:
- Manages terminal sessions (create, list, destroy)
- Executes commands inside sessions (buffered + streaming)
- Returns stdout/stderr/exit codes via a JSON API
- Runs as a long-lived daemon process agents talk to

**Read first:** `.cursor/docs/ARCHITECTURE.md` for the full system design.

---

## Prerequisites

- **Rust toolchain:** `rustup`, `cargo` (stable channel)
- **Target platforms:** macOS (development), Linux (production)
- **Key crates (recommended):**
  - `tokio` — async runtime (sessions are concurrent)
  - `serde` / `serde_json` — JSON protocol
  - `uuid` — session ID generation
  - `tokio::process` — async child process management
  - `hyper` or `axum` — HTTP server (if HTTP transport enabled)
  - `tokio::net::UnixListener` — Unix domain socket server
  - `tracing` — structured logging (never log secrets)
  - `clap` — CLI argument parsing
  - `dotenv` — .env file loading

---

## Project Setup

### Initialize

```bash
cd claw_core
cargo init --name terminal-runtime
```

### Recommended Cargo.toml

```toml
[package]
name = "terminal-runtime"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"
tracing-subscriber = "0.3"
clap = { version = "4", features = ["derive"] }
dotenvy = "0.15"

# Optional: HTTP transport
# axum = "0.7"
# tower = "0.4"
```

---

## Development Workflow

### 1. Build & Run

```bash
cargo build                          # Debug build
cargo run -- --socket /tmp/trl.sock  # Run with Unix socket
cargo run -- --http 127.0.0.1:9100   # Run with HTTP
cargo run -- --stdin                  # CLI/pipe mode
```

### 2. Test

```bash
cargo test                           # Unit tests
cargo test --test integration        # Integration tests

# Manual test via socat (Unix socket)
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock

# Manual test via curl (HTTP)
curl -X POST http://127.0.0.1:9100 \
  -H "Authorization: Bearer $TRL_AUTH_TOKEN" \
  -d '{"id":"1","method":"system.ping","params":{}}'
```

### 3. Lint & Format

```bash
cargo clippy -- -W clippy::all       # Lint
cargo fmt                            # Format
```

---

## Implementation Guide

### Phase 1: MVP (Ship This First)

Build the minimum that makes the agent-runtime loop work.

**Must have:**
- [ ] Session CRUD (`session.create`, `session.list`, `session.info`, `session.destroy`)
- [ ] Buffered command execution (`exec.run`)
- [ ] Unix socket server (JSON over newline-delimited stream)
- [ ] Timeout enforcement per command
- [ ] Environment variable forwarding (runtime → session → command)
- [ ] `system.ping` and `system.stats`
- [ ] Graceful shutdown (SIGTERM → clean up all sessions)
- [ ] Structured logging with `tracing` (no secrets in logs)

**Architecture pattern:**

```rust
// Core types
struct Session {
    id: SessionId,
    shell: PathBuf,
    env: HashMap<String, String>,
    working_dir: PathBuf,
    state: SessionState,
    created_at: Instant,
    child: Option<Child>,
}

enum SessionState {
    Creating,
    Idle,
    Running { command: String, started_at: Instant },
    Terminated,
}

struct SessionPool {
    sessions: RwLock<HashMap<SessionId, Session>>,
    max_sessions: usize,
    default_timeout: Duration,
}

// Protocol
#[derive(Deserialize)]
struct Request {
    id: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Serialize)]
struct Response {
    id: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<ErrorInfo>,
}
```

### Phase 2: Streaming & HTTP

- [ ] Streaming command execution (`exec.stream`)
- [ ] HTTP transport with bearer token auth
- [ ] `exec.cancel` (send signals to running commands)
- [ ] Session idle timeout / auto-cleanup

### Phase 3: Isolation & Multi-Runtime

- [ ] Per-session chroot (optional, Linux)
- [ ] cgroup resource limits (optional, Linux)
- [ ] Runtime discovery protocol (agent finds available runtimes)
- [ ] Docker-backed runtime variant

---

## Key Implementation Details

### Process Management

```rust
use tokio::process::Command;

// Spawn a command inside a session
let mut child = Command::new(&session.shell)
    .arg("-c")
    .arg(&command)
    .current_dir(&session.working_dir)
    .envs(&session.env)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true)    // safety: kill if we drop the handle
    .spawn()?;

// With timeout
let result = tokio::time::timeout(
    timeout_duration,
    child.wait_with_output()
).await;

match result {
    Ok(Ok(output)) => { /* normal completion */ },
    Ok(Err(e)) => { /* spawn/io error */ },
    Err(_) => { /* timeout — kill the process */ },
}
```

### Session ID Generation

```rust
use uuid::Uuid;

fn new_session_id() -> String {
    let uuid = Uuid::new_v4();
    format!("s-{}", &uuid.to_string()[..8])  // e.g., "s-a1b2c3d4"
}
```

### Unix Socket Server (Sketch)

```rust
use tokio::net::UnixListener;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

async fn serve(socket_path: &str, pool: Arc<SessionPool>) -> Result<()> {
    let listener = UnixListener::bind(socket_path)?;
    // Set permissions to 0600
    std::fs::set_permissions(socket_path, std::fs::Permissions::from_mode(0o600))?;

    loop {
        let (stream, _) = listener.accept().await?;
        let pool = pool.clone();
        tokio::spawn(async move {
            let (reader, mut writer) = stream.into_split();
            let mut lines = BufReader::new(reader).lines();
            while let Some(line) = lines.next_line().await? {
                let request: Request = serde_json::from_str(&line)?;
                let response = handle_request(&pool, request).await;
                let json = serde_json::to_string(&response)?;
                writer.write_all(json.as_bytes()).await?;
                writer.write_all(b"\n").await?;
            }
            Ok::<_, anyhow::Error>(())
        });
    }
}
```

---

## Testing Strategy

### Unit Tests

- Session state machine transitions
- Protocol serialization/deserialization
- Environment variable merging logic
- Timeout calculation

### Integration Tests

- Create session → run command → verify output → destroy session
- Timeout enforcement (run `sleep 999`, verify it gets killed)
- Multiple concurrent sessions
- Error cases (invalid session ID, session busy, etc.)
- Graceful shutdown while commands are running

### Manual Testing Script

```bash
#!/bin/bash
# test-trl.sh — Quick smoke test

SOCK="/tmp/trl-test.sock"

# Start runtime in background
cargo run -- --socket "$SOCK" &
TRL_PID=$!
sleep 1

send() { echo "$1" | socat - UNIX-CONNECT:"$SOCK"; }

# Ping
send '{"id":"1","method":"system.ping","params":{}}'

# Create session
send '{"id":"2","method":"session.create","params":{"shell":"/bin/zsh"}}'

# Run command
send '{"id":"3","method":"exec.run","params":{"session_id":"s-XXX","command":"echo hello"}}'

# List sessions
send '{"id":"4","method":"session.list","params":{}}'

# Cleanup
send '{"id":"5","method":"session.destroy","params":{"session_id":"s-XXX"}}'

kill $TRL_PID
rm -f "$SOCK"
```

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Zombie processes after session destroy | Always `kill_on_drop(true)` and explicitly reap with `child.wait()` |
| Socket file left after crash | Check for and remove stale socket on startup |
| Secrets in log output | Use `tracing` with a custom formatter that redacts env values |
| Blocking the event loop | All process I/O must be async (`tokio::process`, not `std::process`) |
| Session state desync | Use state machine pattern; transitions are the only way to change state |
| Concurrent access to session | `RwLock` on the pool, `Mutex` on individual sessions if needed |
