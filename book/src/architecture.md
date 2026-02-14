# Architecture — Terminal Lightweight Runtime Layer

A Rust-based execution layer that sits between the AI agent ("brain") and the operating system, managing terminal sessions, running commands, and returning output through a clean API.

## Overview

The Terminal Runtime Layer (TRL) solves a fundamental problem: AI agents like OpenClaw currently execute commands directly on the host via raw `exec`. This is fragile, uncontrolled, and impossible to scale.

TRL is the **execution pod** — it owns terminal sessions, runs commands inside them, captures output, and exposes a minimal API for the agent to talk to.

```
┌──────────────────────────────────────────────┐
│  Agent (OpenClaw / any AI orchestrator)       │
│  - Receives user intent (Telegram, CLI, etc)  │
│  - Decides WHAT to run and WHERE              │
└──────────────────┬───────────────────────────┘
                   │  JSON over socket/HTTP
                   │  "run <cmd> in session <id>"
                   ▼
┌──────────────────────────────────────────────┐
│  Terminal Runtime Layer (Rust binary)        │
│  - Manages sessions (id ↔ process group)     │
│  - Spawns processes, captures stdout/stderr  │
│  - Timeout, env vars, lightweight isolation   │
└──────────────────┬───────────────────────────┘
                   │  fork/exec, pipes
                   ▼
┌──────────────────────────────────────────────┐
│  OS (macOS / Linux)                           │
│  - Real processes (shell, python, node, etc)  │
└──────────────────────────────────────────────┘
```

## Maturity Levels

| Level | Description | What Changes |
|-------|-------------|--------------|
| **L0** | Direct exec on host | Agent calls `exec` directly. No session management. |
| **L1** | Single runtime | Agent talks to ONE TRL instance. TRL manages sessions, returns output. |
| **L2** | Multi-runtime | Multiple TRL instances (host, Docker, remote SSH). Agent picks runtime per task. |

**We're building L1 first.** L2 comes naturally once the API is stable.

## Core Components

### 1. Session Manager

Owns the lifecycle of terminal sessions. Each session has:

- **Session ID** — unique identifier (UUID or short hash)
- **Shell process** — the underlying shell (bash/zsh) or direct command
- **Working directory** — isolated per session
- **Environment** — variables inherited + session-specific overrides
- **State** — `creating`, `idle`, `running`, `terminated`

### 2. Command Executor

Receives execution requests and runs them inside a session:

- Spawns child process via `std::process::Command`
- Pipes stdout/stderr back to caller
- Supports **synchronous** (wait for exit) and **streaming** (real-time output) modes
- Enforces timeouts (configurable per-command or per-session)

### 3. Output Handler

- **Buffered mode** — collect all output, return on process exit
- **Streaming mode** — push output chunks as they arrive
- Always includes: stdout, stderr, exit code, duration

### 4. API Server

- **Transport:** Unix domain socket (local), HTTP (remote/Docker), stdin/stdout (CLI)
- **Protocol:** JSON request/response
- **Authentication:** Token-based for HTTP; file permissions for Unix socket

### 5. Isolation Layer (Optional)

| Technique | Effort | Isolation |
|-----------|--------|-----------|
| Environment variables | Trivial | Env scoping |
| Working directory | Trivial | File system scoping |
| `cgroups` (Linux) | Medium | CPU, memory limits (see [Resource Control](resource-control.md)) |
| Docker | High | Full containerization |

## Design Principles

1. **Single binary, zero dependencies at runtime.**
2. **The agent is the brain; TRL is the hands.** TRL only executes and reports.
3. **Fail loud, fail safe.** Structured errors, enforced timeouts, zombie cleanup.
4. **Secrets pass through, never persist.**
5. **MVP first, scale later.** Unix socket + buffered output + session CRUD = shippable.
