# Claw Core

<div style="margin-top: 1.5rem;" aria-hidden="true">&nbsp;</div>




The **core execution layer** that packages and runs agent CLI commands. It manages terminal sessions, executes commands with timeouts, and returns structured output through a clean JSON API.

## What Is This?

**Claw Core** is the agent CLI packing core — the middle layer between AI agents and the OS. Agents run CLI commands (e.g. `cursor agent`, `npm run`, shell scripts); Claw Core wraps that execution with sessions, timeouts, and structured output.

Instead of agents calling `exec` directly on the host (fragile, uncontrolled, unscalable), they talk to **Claw Core** — a lightweight runtime that:

- **Manages sessions** — create, list, inspect, destroy terminal sessions
- **Executes commands** — buffered or streaming, with timeout enforcement
- **Handles secrets** — forwards env vars to processes without persisting them
- **Exposes a clean API** — JSON over Unix socket, HTTP, or stdin/stdout

```
Agent (CLI commands) ──JSON──> Claw Core (packing core) ──fork/exec──> OS processes
```

## Quick Start

### Install (no Rust needed)

Download a prebuilt binary from [GitHub Releases](https://github.com/wchklaus97/claw-core/releases), or:

```bash
curl -sSL https://raw.githubusercontent.com/your-org/claw/main/scripts/install-from-release.sh | bash -s v0.1.0
```

### Run the Runtime

```bash
cargo run -- --socket-path /tmp/trl.sock
# Or: claw_core --socket-path /tmp/trl.sock
```

### Probe the Runtime

```bash
echo '{"id":"1","method":"system.ping","params":{}}' | socat - UNIX-CONNECT:/tmp/trl.sock
```

## Design Principles

1. **Single binary, zero runtime dependencies** — just Rust
2. **Agent is the brain, TRL is the hands** — TRL never decides what to run
3. **Fail loud, fail safe** — structured errors, enforced timeouts, zombie cleanup
4. **Secrets pass through, never persist** — env vars flow, never written to disk
5. **MVP first** — Unix socket + buffered exec + session CRUD = shippable

## Status

**Phase: Production v1** (Unix socket + buffered execution)

- [x] MVP: `system.ping`, `session.*`, `exec.run`, `system.stats`
- [x] Tests and CI
- [ ] Streaming support
- [ ] HTTP transport
- [ ] Multi-runtime support (L2)
