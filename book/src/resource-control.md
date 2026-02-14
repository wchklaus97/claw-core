# CPU & RAM Control — Keeping the Service Layer Alive

Mechanisms to limit CPU and memory use so that runaway sessions or commands do **not** crash the whole runtime.

## Goal

- **Child processes** (commands run in sessions) must not exhaust host CPU or RAM.
- **Runtime process** (the Rust daemon) must stay within bounds.
- **Failure mode:** When limits are hit, **reject or kill the offending unit** (one session / one command), not the entire service.

## 1. Application-Level Controls (All Platforms)

### 1.1 Session and concurrency limits

| Control | Purpose | Example |
|--------|---------|---------|
| **Max sessions** | Cap total sessions | `max_sessions: 64` |
| **Max concurrent commands** | Limit commands at once | 1 per session or 16 global |
| **Session idle timeout** | Destroy idle sessions | `max_idle_sec: 3600` |
| **Max sessions per client** | Optional | e.g. 8 per client |

### 1.2 Per-command limits

| Control | Purpose | Example |
|--------|---------|---------|
| **Command timeout** | Stop long-running commands | `timeout_s: 300` per `exec.run` |
| **Default timeout** | Fallback | e.g. 60s |
| **Output buffer cap** | Limit stdout/stderr size | e.g. 4 MiB per stream |
| **Stdin size cap** | Limit input | e.g. 1 MiB |

### 1.3 Backpressure and rejection

- **Reject new sessions** when `active_sessions >= max_sessions`
- **Reject new commands** when session is busy → `SESSION_BUSY`
- **Optional:** Rate limit API requests per client

### 1.4 Runtime self-monitoring

- **Periodic reaping** — zombie children, dead sessions
- **Health endpoint** — `system.ping` / `system.stats`
- **Graceful shutdown** — On SIGTERM, stop accepting, drain or kill commands, destroy sessions

## 2. Per-Child Resource Limits (Unix)

Use **setrlimit** in the child (before exec). In Rust: `Command::unsafe_pre_exec`.

| Resource | Constant | Effect |
|----------|----------|--------|
| **CPU time (seconds)** | `RLIMIT_CPU` | Process killed when CPU time exceeds limit |
| **Address space (bytes)** | `RLIMIT_AS` | Virtual memory cap |
| **Process count** | `RLIMIT_NPROC` | Limits fork bombs from the command |
| **Open files** | `RLIMIT_NOFILE` | Prevents exhausting FDs |

**Rust crate:** `rlimit` (docs.rs/rlimit) — Unix-only.

**Config:** Make limits configurable (e.g. `limit_cpu_sec`, `limit_memory_bytes`, `limit_nproc`).

## 3. Cgroups (Linux) — Stronger Isolation

For **strict** CPU and memory limits per session, use cgroups so the kernel enforces them.

| Goal | Mechanism |
|------|------------|
| **Memory cap per session** | cgroup v2 `memory.max` |
| **CPU cap per session** | cgroup v2 `cpu.max` (quota + period) |
| **Scope** | One cgroup per session; add shell and children to that cgroup |

**Rust crate:** `cgroups-rs` (kata-containers/cgroups-rs).

## 4. Summary: What to Implement and When

| Layer | MVP (ship first) | Next (L2) |
|-------|------------------|-----------|
| **Application** | Max sessions, command timeout, output buffer cap, reject at capacity, graceful shutdown | Session idle timeout, per-client limit, rate limit |
| **Child process** | `setrlimit` in `pre_exec`: CPU, AS, NPROC (configurable) | Tune per env |
| **Linux isolation** | — | cgroups per session (memory.max, cpu.max) |
| **Memory layer** | Cap index size or batch size | Query rate limit, monitoring |

**Principle:** Prefer **application-level + setrlimit** first (works on macOS and Linux, no root). Add **cgroups** when you need stronger guarantees on Linux.

## 5. Checklist: Avoid Service Layer Crash

- [ ] **max_sessions** configured; reject when full
- [ ] **Command timeout** enforced (default + per-request)
- [ ] **Output buffer** capped (stdout/stderr)
- [ ] **pre_exec** sets **RLIMIT_CPU** and **RLIMIT_AS** (and optionally NPROC) for each child
- [ ] **Graceful shutdown** on SIGTERM
- [ ] **Periodic reaping** of zombies and dead sessions
- [ ] (L2) **cgroups** per session on Linux for hard memory/CPU limits
