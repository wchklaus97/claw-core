# Claw-Core Support for ZeroClaw — Integration via Crates

## Status: Implemented

The integration is built using a **protocol crate** (`claw-core-protocol`) and a **feature flag** (`claw-core`) in ZeroClaw.

## Architecture

```
crates.io                        claw repo                          zeroclaw/
┌──────────────────┐   publish   ┌───────────────────────────┐
│ claw-core-       │ <────────── │ crates/claw-core-protocol │
│ protocol v0.1.0  │             │  src/types.rs (protocol)  │
└────────┬─────────┘             │  src/client.rs (async)    │
         │                       │  src/lib.rs               │
         │ optional dep          └───────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────┐
│ zeroclaw (--features claw-core)                               │
│                                                               │
│  src/tools/claw_core_exec.rs  ──► ClawCoreExecTool            │
│       │                            implements Tool trait       │
│       │  JSON over Unix socket                                │
│       ▼                                                       │
│  claw_core daemon (/tmp/trl.sock)                             │
│                                                               │
│  src/config/schema.rs         ──► ClawCoreConfig              │
│       enabled, socket_path, auto_session, default_timeout_s   │
│                                                               │
│  src/tools/mod.rs             ──► conditional registration    │
│       #[cfg(feature = "claw-core")] if config.enabled         │
└───────────────────────────────────────────────────────────────┘
```

## Components

### 1. `claw-core-protocol` crate (`crates/claw-core-protocol/`)

Pure protocol types and async Unix socket client. No dependency on ZeroClaw.

- **types.rs** — `RpcRequest`, `RpcResponse`, `RpcError`, `CreateSessionParams`, `ExecRunParams`, `ExecRunResult`, `SessionInfo`, `PingResult`, `SystemStats`, error codes.
- **client.rs** — `ClawCoreClient::connect(socket_path)`, typed convenience methods: `ping()`, `stats()`, `create_session()`, `list_sessions()`, `session_info()`, `destroy_session()`, `exec_run()`.
- **lib.rs** — Re-exports everything at crate root.

Published to **crates.io** via `crate-v*` tags.

### 2. ZeroClaw feature flag (`--features claw-core`)

- **Cargo.toml**: `claw-core-protocol = { optional = true }`, feature `claw-core = ["dep:claw-core-protocol"]`.
- **ClawCoreExecTool** (`src/tools/claw_core_exec.rs`): Tool that connects to the daemon, creates/reuses sessions, runs `exec.run`, maps results to `ToolResult`.
- **ClawCoreConfig** (`src/config/schema.rs`): `enabled`, `socket_path`, `auto_session`, `default_timeout_s`.
- **Registration** (`src/tools/mod.rs`): Conditional behind `#[cfg(feature = "claw-core")]` + `config.claw_core.enabled`.

### 3. CI/CD — Three Release Tracks

| Track | Workflow | Tag pattern | Publishes to |
|-------|----------|-------------|-------------|
| **OpenClaw** | `release-openclaw.yml` | `v*` | GitHub Releases + npmjs |
| **ZeroClaw** | `zeroclaw/.github/workflows/release.yml` | `v*` | GitHub Releases |
| **Protocol crate** | `release-crate.yml` | `crate-v*` | **crates.io** |

## Usage

### Standalone (Rust project)

```toml
[dependencies]
claw-core-protocol = "0.1"
```

```rust
use claw_core_protocol::{ClawCoreClient, CreateSessionParams, ExecRunParams};

let mut client = ClawCoreClient::connect("/tmp/trl.sock").await?;
let session = client.create_session(CreateSessionParams::default()).await?;
let result = client.exec_run(ExecRunParams {
    session_id: session.session_id.clone(),
    command: "echo hello".into(),
    timeout_s: Some(30),
    stdin: None,
    env: None,
}).await?;
```

### With ZeroClaw

```bash
cargo install zeroclaw --features claw-core
```

```toml
# ~/.zeroclaw/config.toml
[claw_core]
enabled = true
socket_path = "/tmp/trl.sock"
```

## Why a crate, not the OpenClaw plugin?

- The **OpenClaw plugin** (Node/TS + Python) cannot run inside ZeroClaw (no npm/Node plugin system).
- The **claw_core daemon** speaks a simple JSON-over-Unix-socket protocol that is runtime-agnostic.
- A **Rust crate** is the natural extension point for ZeroClaw: optional dependency + feature flag + conditional tool registration.
- The protocol crate is reusable by any Rust project, not just ZeroClaw.

## Files

| File | Purpose |
|------|---------|
| `crates/claw-core-protocol/Cargo.toml` | Crate manifest |
| `crates/claw-core-protocol/src/lib.rs` | Re-exports |
| `crates/claw-core-protocol/src/types.rs` | Protocol types |
| `crates/claw-core-protocol/src/client.rs` | Async client |
| `crates/claw-core-protocol/README.md` | Crate documentation |
| `zeroclaw/src/tools/claw_core_exec.rs` | ClawCoreExecTool |
| `zeroclaw/src/config/schema.rs` | ClawCoreConfig (added) |
| `zeroclaw/src/tools/mod.rs` | Registration (added) |
| `zeroclaw/Cargo.toml` | Feature + dep (added) |
| `.github/workflows/release-openclaw.yml` | OpenClaw release |
| `.github/workflows/release-crate.yml` | Crate release |
| `.github/workflows/ci.yml` | CI (updated) |
