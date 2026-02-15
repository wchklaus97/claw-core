# Claw Core

[![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)](https://www.rust-lang.org/)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[简体中文](README-zh-Hans.md) | [繁體中文](README-zh-Hant.md)

![Claw Core banner](assets/images/claw-core-hero-banner.jpeg)

Agent CLI execution runtime for stable, controlled, and observable command automation.

Fully supports OpenClaw and provides a Cursor plugin integration (`plugin/`) for OpenClaw workflows. Tested with OpenClaw 2026.2.13 and Cursor IDE 2.5.11 — see [plugin README](plugin/README.md#compatibility) for details.

---

## What

Claw Core is a Rust runtime that sits between AI agents and OS process execution.
Agents call Claw Core through JSON protocol instead of using direct `exec`.

```text
Agent / Gateway  -->  Claw Core (JSON API)  -->  OS processes
```

---

## Why

Direct process execution from agents is often fragile in production.
Claw Core standardizes runtime behavior and reduces operational risk.

---

## Problems Claw Core Solves

- **Runaway process control**: command/session timeout and cleanup
- **Session isolation**: explicit session lifecycle and boundaries
- **Unstructured execution results**: normalized JSON responses
- **Low observability**: runtime stats for health checks
- **Secret leakage risk**: env pass-through without persistence
- **OpenClaw runtime wiring**: direct Cursor plugin-based integration for real OpenClaw workflows

---

## How It Works

1. Agent sends JSON request (`system.ping`, `session.*`, `exec.run`, `system.stats`).
2. Claw Core validates and dispatches to session/executor modules.
3. Runtime executes command with timeout and captures outputs.
4. Claw Core returns structured response to caller.

---

## Quick Start

### Prerequisites

- Rust stable
- `socat` for local socket probe

### Run

```bash
cargo run -- --socket-path /tmp/trl.sock
```

### Ping Probe

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

### Test

```bash
cargo test
./scripts/smoke.sh
```

### Before Pushing

Run the pre-push script to validate core runtime and release build:

```bash
./scripts/pre-push-test.sh
```

With OpenClaw installed, add `--openclaw` to also verify plugin integration:

```bash
./scripts/pre-push-test.sh --openclaw
```

See [verify_integration.sh](scripts/verify_integration.sh) and [plugin README](plugin/README.md) for OpenClaw setup (clear config, install from local path). One-command install: `openclaw plugins install @wchklaus97hk/claw-core` — the daemon auto-downloads the binary on first start (OpenClaw does not run npm postinstall).

---

## Build and Deploy

### Local Build

```bash
cargo build --release
```

### Binary Release

Release workflow: `.github/workflows/release.yml`

Trigger:

- push tag `v*` (example: `v0.1.0`)

Artifacts:

- Linux: `x86_64`, `aarch64`
- macOS: `x86_64`, `aarch64`

**Note:** Windows is not supported (claw_core uses Unix domain sockets, `rlimit`, and other Unix-only APIs).

---

## Versioning

- Current crate version: `0.1.0`
- Release source of truth: git tag `v*`

Recommended flow:

1. update `Cargo.toml` version
2. commit
3. create/push tag: `git tag v0.1.0 && git push origin v0.1.0`
4. release workflow publishes archives

---

## Project Layout (Core)

```text
claw/
├── src/                   # runtime implementation
├── tests/                 # integration/unit tests
├── scripts/               # smoke/install/helper scripts
├── plugin/                # Cursor plugin integration for OpenClaw
├── .github/workflows/     # CI and release workflows
├── README.md
├── README-zh-Hans.md
└── README-zh-Hant.md
```

---

## References

- [Plugin README](plugin/README.md)
- [Pre-push test](scripts/pre-push-test.sh)
- [Integration verification](scripts/verify_integration.sh)
- [Install OpenClaw plugin](scripts/install-claw-core-openclaw.sh)
- [Remove OpenClaw plugin](scripts/remove-claw-core-openclaw.sh)
- [Install binary from release](scripts/install-from-release.sh)

---

## License

MIT
