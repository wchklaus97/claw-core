# Session Lifecycle — Terminal Runtime Layer

How terminal sessions are created, used, and destroyed within the runtime layer.

## Session States

```
                    session.create
                         │
                         ▼
                    ┌──────────┐
                    │ CREATING │  Setting up shell, env, cwd
                    └────┬─────┘
                         │ success
                         ▼
              ┌─────────────────────┐
         ┌───>│        IDLE         │<────────────┐
         │    │  Ready for commands │              │
         │    └─────────┬───────────┘              │
         │              │ exec.run / exec.stream   │
         │              ▼                          │
         │    ┌──────────────────┐                 │
         │    │     RUNNING      │  Command active │
         │    │  stdout/stderr   │                 │
         │    │  flowing         │                 │
         │    └────────┬─────────┘                 │
         │             │                           │
         │     ┌───────┴────────┐                  │
         │     │                │                  │
         │  exit/timeout    cancel                 │
         │     │                │                  │
         │     ▼                ▼                  │
         │  result returned  cancelled             │
         └────────────────────┴────────────────────┘
                         │
                  session.destroy
                         │
                         ▼
                  ┌──────────────┐
                  │  TERMINATED  │  Cleaned up
                  └──────────────┘
```

## State Descriptions

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| **CREATING** | Shell process is starting | Wait (internal only) |
| **IDLE** | Session is alive, no command running | `exec.run`, `exec.stream`, `session.destroy`, `session.info` |
| **RUNNING** | A command is actively executing | `exec.cancel`, `session.info`, `session.destroy` |
| **TERMINATED** | Session is dead, cleaned up | `session.info` (read-only) |

## Session Creation

When `session.create` is called, the runtime:

1. Generates a session ID (e.g., `s-a1b2c3`)
2. Resolves the shell (provided or `/bin/sh`)
3. Prepares environment (runtime base + session-specific)
4. Sets working directory
5. Starts the shell process
6. Registers in session pool
7. Returns session metadata

### Failure Modes

| Failure | Handling |
|---------|----------|
| Shell binary not found | Return error, no session created |
| Too many active sessions | Return `MAX_SESSIONS_REACHED` |
| Shell crashes immediately | Return error, clean up |

## Command Execution Within a Session

### Buffered Mode (`exec.run`)

1. Agent sends `exec.run` with session ID and command
2. TRL checks session state is `IDLE`
3. TRL writes command to session's shell stdin
4. TRL reads stdout/stderr until command completes (or timeout)
5. TRL captures exit code, session returns to `IDLE`
6. TRL returns `{stdout, stderr, exit_code, duration_ms}` to agent

### Streaming Mode (`exec.stream`)

1. Agent sends `exec.stream`; TRL returns `stream_id`
2. TRL writes command to shell stdin
3. As output arrives, TRL pushes chunks to agent
4. On completion, TRL pushes final `exit` chunk; session returns to `IDLE`

### Timeout Handling

When a timeout fires:

1. Send `SIGTERM` to the command's process group
2. Wait 5 seconds
3. If still alive, send `SIGKILL`
4. Return result with `timed_out: true`
5. Session returns to `IDLE` (session survives timeouts)

## Session Destruction

When `session.destroy` is called:

1. If a command is running, cancel it first (SIGTERM → SIGKILL)
2. Send SIGTERM to the session's shell process
3. Wait up to 5 seconds for graceful exit
4. If `force: true` or grace period exceeded, send SIGKILL
5. Close all pipes, remove from session pool

### Zombie Prevention

- Use async process handling that automatically reaps
- Periodically scan for orphaned PIDs
- On runtime shutdown, destroy all active sessions

## Session Pool Management

- **max_sessions** — configurable limit
- **Housekeeping** — periodic cleanup of stale/idle sessions, dead sessions
- **Concurrency** — multiple sessions can be IDLE or RUNNING; commands within a single session are sequential in buffered mode
