# API Specification — Terminal Runtime Layer

Protocol and endpoint definitions for communication between the agent and the runtime layer.

## Transport

| Mode | When to Use | Details |
|------|------------|---------|
| **Unix socket** | Local, same machine | **Implemented.** Default path: `/tmp/trl.sock` (or `TRL_SOCKET_PATH`). Fast, secure (file perms). |
| **HTTP** | Remote, Docker, multi-host | *Planned.* Would bind to `127.0.0.1:<port>` with token auth. |
| **Stdin/Stdout** | CLI testing, piping | *Planned.* One-shot mode. Read JSON from stdin, write JSON to stdout. |

## Protocol

All messages are **JSON**. Every request has a `method` and optional `params`. Every response has `ok` (bool), optional `data`, and optional `error`.

### Request Format

```json
{
  "id": "req-001",
  "method": "session.create",
  "params": {
    "shell": "/bin/zsh",
    "env": {"MY_VAR": "value"},
    "working_dir": "/tmp/sandbox"
  }
}
```

### Response Format (Success)

```json
{
  "id": "req-001",
  "ok": true,
  "data": {
    "session_id": "s-a1b2c3",
    "created_at": "2026-02-13T12:00:00Z"
  }
}
```

### Response Format (Error)

```json
{
  "id": "req-001",
  "ok": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No session with id 's-xyz'"
  }
}
```

## Methods

### Session Management

#### `session.create`

Create a new terminal session.

**Params:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `shell` | string | No | `/bin/sh` | Shell to use for the session |
| `env` | object | No | `{}` | Additional environment variables |
| `working_dir` | string | No | `/tmp` | Initial working directory |
| `name` | string | No | `null` | Human-readable session label |
| `timeout_s` | int | No | `0` (none) | Default command timeout for this session |

**Response data:** `session_id`, `shell`, `working_dir`, `state`, `created_at`

---

#### `session.list`

List all active sessions. **Params:** None.

---

#### `session.info`

Get details about a specific session. **Params:** `session_id` (required).

---

#### `session.destroy`

Terminate and clean up a session. **Params:** `session_id` (required), `force` (optional bool).

---

### Command Execution

#### `exec.run`

Execute a command in a session (buffered mode). Waits for completion.

**Params:** `session_id`, `command`, `timeout_s`, `stdin`, `env`

**Response data:** `stdout`, `stderr`, `exit_code`, `duration_ms`, `timed_out`

---

#### `exec.stream` *(planned)*

Execute with real-time output streaming. Would return `stream_id`, then push chunks. Not yet implemented.

---

#### `exec.cancel` *(planned)*

Cancel a running command. **Params:** `session_id`, `signal` (optional). Not yet implemented.

---

### System

#### `system.ping`

Health check. Response: `uptime_s`, `version`.

#### `system.stats`

Runtime statistics: `active_sessions`, `total_commands_run`, `uptime_s`, `memory_rss_bytes`.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `SESSION_NOT_FOUND` | No session with given ID |
| `SESSION_BUSY` | Session already running a command |
| `COMMAND_TIMEOUT` | Command exceeded timeout |
| `COMMAND_FAILED` | Command exited with non-zero |
| `INVALID_PARAMS` | Missing or malformed parameters |
| `INTERNAL_ERROR` | Unexpected runtime error |
| `AUTH_FAILED` | Invalid or missing authentication token |

---

## Authentication (HTTP mode)

When running over HTTP, requests must include:

```
Authorization: Bearer <token>
```

The token is set via `TRL_AUTH_TOKEN` environment variable when starting the runtime. Unix socket mode relies on filesystem permissions instead.
