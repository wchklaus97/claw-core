# Security & Token Handling — Terminal Runtime Layer

How the runtime handles secrets, authentication, and isolation boundaries.

## Core Principle

**Secrets pass through. They never persist.**

The runtime receives tokens and environment variables from the agent or startup configuration, forwards them to child processes, and never writes them to disk.

## Token Flow

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────┐
│  Agent / Config  │────>│  Terminal Runtime │────>│ Child Process│
│  TG_BOT_TOKEN=.. │     │  Holds in memory  │     │  Sees in env │
│  CURSOR_API_KEY= │     │  Never writes disk│     │  at runtime  │
└──────────────────┘     └───────────────────┘     └──────────────┘
```

## Environment Variable Handling

### Injection Points

1. **Runtime startup** — from the runtime's own environment or `.env` file
2. **Session creation** — per-session vars via `session.create` params
3. **Command execution** — per-command vars via `exec.run` / `exec.stream` params

### Scoping Rules

| Scope | Visibility | Lifetime |
|-------|-----------|----------|
| Runtime-level | All sessions, all commands | Until runtime restarts |
| Session-level | All commands in that session | Until session destroyed |
| Command-level | Only the specific command | Until command exits |

### What NOT to Do

- **Never log env var values.** Log keys only, never values.
- **Never write env vars to disk.** No temp files, no config dumps.
- **Never return env vars in API responses** unless explicitly requested (and consider masking).
- **Never embed secrets in the runtime binary.**

## API Authentication

### Unix Socket Mode (Default)

- **Mechanism:** File system permissions on the socket file
- **Recommendation:** Set socket permissions to `0600` (owner only)

### HTTP Mode

- **Mechanism:** Bearer token authentication
- **Token source:** `TRL_AUTH_TOKEN` environment variable
- **Every request:** `Authorization: Bearer <token>`
- If `TRL_AUTH_TOKEN` is not set when HTTP is enabled, the runtime should **refuse to start**.

## Isolation Boundaries

### What TRL Isolates

| Aspect | How |
|--------|-----|
| **Environment** | Each session gets its own env set. |
| **Working directory** | Each session has its own cwd. |
| **Process tree** | Each session's processes are tracked; `session.destroy` kills the tree. |
| **Output** | stdout/stderr are per-session, per-command. |

### What TRL Does NOT Isolate (MVP)

| Aspect | Future Fix |
|--------|------------|
| **File system** | L2: chroot or Docker |
| **Network** | L2: network namespaces |
| **Resources** | L2: cgroups; see [Resource Control](resource-control.md) |
| **Users** | L2: per-session user |

## Threat Model (For Agent Developers)

| Threat | Mitigation |
|--------|-----------|
| Agent sends malicious command | TRL executes blindly — agent is responsible for safety. TRL provides timeouts and kill switches. |
| Secret exfiltration via output | Agent should redact secrets before displaying to users. |
| Unauthorized API access | Socket permissions (local) or bearer token (HTTP). Fail secure if misconfigured. |
| Session hijacking | Session IDs are random UUIDs. No enumeration. |
| Zombie processes after crash | Periodic reaping; clean orphaned processes on startup. |
| Resource exhaustion | Max session limits, per-command timeouts, setrlimit; see [Resource Control](resource-control.md). |

## Security Checklist for Deployment

- [ ] Runtime runs as **non-root** user
- [ ] `.env` file has `0600` permissions
- [ ] Unix socket has `0600` permissions
- [ ] `TRL_AUTH_TOKEN` is set if HTTP mode is enabled
- [ ] Logging does NOT include env var values
- [ ] Max session limit is configured
- [ ] Default timeout is set
- [ ] Runtime binary is not world-writable
