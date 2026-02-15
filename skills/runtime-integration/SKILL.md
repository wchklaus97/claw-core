# SKILL.md — Runtime Integration (Agent ↔ TRL)

> How AI agents connect to, communicate with, and effectively use the Terminal Runtime Layer for command execution.

---

## What This Skill Is For

You're an agent (or building agent tooling) that needs to:

- Execute shell commands in managed sessions instead of raw `exec`
- Get structured output (stdout, stderr, exit code, timing)
- Manage multiple concurrent environments
- Handle long-running processes with streaming output

**Read first:** `.cursor/docs/API-SPEC.md` for the full protocol reference.

---

## Quick Start

### Current v1 Capability

- Available now: `system.ping`, `system.stats`, `session.create`, `session.list`, `session.info`, `session.destroy`, `exec.run`
- Not in v1 yet: `exec.stream`, `exec.cancel`, HTTP transport
- Transport in v1: Unix socket newline-delimited JSON (`/tmp/trl.sock` by default)

### 1. Connect to the Runtime

The runtime listens on a Unix socket in v1.

**Unix socket (preferred for local):**

```python
import socket
import json

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.connect("/tmp/trl.sock")

def send_request(method, params=None):
    request = {
        "id": str(uuid4()),
        "method": method,
        "params": params or {}
    }
    sock.sendall((json.dumps(request) + "\n").encode())
    response = sock.makefile().readline()
    return json.loads(response)
```

HTTP mode is planned for a later phase.

### 2. Create a Session

```python
result = send_request("session.create", {
    "shell": "/bin/zsh",
    "name": "build-env",
    "working_dir": "/tmp/my-project",
    "env": {
        "NODE_ENV": "development",
        "PATH": "/usr/local/bin:/usr/bin:/bin"
    }
})
session_id = result["data"]["session_id"]
# e.g., "s-a1b2c3d4"
```

### 3. Run Commands

```python
result = send_request("exec.run", {
    "session_id": session_id,
    "command": "npm install && npm test",
    "timeout_s": 120
})

print(result["data"]["stdout"])      # Build output
print(result["data"]["stderr"])      # Warnings/errors
print(result["data"]["exit_code"])   # 0 = success
print(result["data"]["duration_ms"]) # How long it took
```

### 4. Clean Up

```python
send_request("session.destroy", {"session_id": session_id})
```

---

## Agent Integration Patterns

### Pattern 1: One Session Per Task

Simple. Create a fresh session for each task, destroy when done.

```
Agent receives task "build project X"
  → session.create (fresh env)
  → exec.run "git clone ..."
  → exec.run "cd project && make"
  → Read results
  → session.destroy
  → Report to user
```

**Best for:** Short, isolated tasks. Build-and-report workflows.

### Pattern 2: Persistent Named Sessions

Keep sessions alive across multiple agent interactions.

```
Agent receives "set up dev environment"
  → session.create (name: "dev-env")
  → exec.run "nvm use 18 && npm install"
  → [session stays alive]

Later: Agent receives "run the tests"
  → session.list → find "dev-env"
  → exec.run "npm test"
  → Report results
```

**Best for:** Interactive development. Multi-step workflows where state accumulates.

### Pattern 3: Parallel Execution

Run commands across multiple sessions simultaneously.

```python
# Create specialized sessions
build_session = create_session(name="build", working_dir="/app")
test_session = create_session(name="test", working_dir="/app")
lint_session = create_session(name="lint", working_dir="/app")

# Run in parallel (async)
results = await asyncio.gather(
    exec_run(build_session, "cargo build"),
    exec_run(test_session, "cargo test"),
    exec_run(lint_session, "cargo clippy"),
)

# Aggregate results
for name, result in zip(["build", "test", "lint"], results):
    print(f"{name}: exit={result['exit_code']}")
```

**Best for:** CI-like workflows. Independent tasks that benefit from parallelism.

### Pattern 4: Streaming Long Processes

Monitor long-running commands in real time.

```python
# Start streaming
stream = send_request("exec.stream", {
    "session_id": session_id,
    "command": "docker build -t myapp ."
})
stream_id = stream["data"]["stream_id"]

# Read chunks as they arrive
for chunk in read_stream(stream_id):
    if chunk["type"] == "stdout":
        log(chunk["data"])                    # Show progress
    elif chunk["type"] == "stderr":
        log(chunk["data"], level="warn")
    elif chunk["type"] == "exit":
        final_code = chunk["exit_code"]       # Done
        break
```

**Best for:** Build processes, deployments, anything that takes >10s.

---

## Cursor CLI & TRL

TRL can run any shell command, including `cursor agent "..."` or `agent "..."`. When TRL runs Cursor agent, that process is a **child of the TRL session**. If the session is destroyed or times out, the child (Cursor agent) is killed.

**Preferred path:** If using OpenClaw, delegate via `sessions_spawn` with `agentId: "cursor-dev"` instead of exec'ing `agent` or `cursor agent` — direct exec in headless mode can hang unless `--output-format stream-json` is used.

### Guidelines

| Scenario | Recommendation |
|----------|----------------|
| **Long-running Cursor agent** | Do **not** use TRL. Use OpenClaw `sessions_spawn` (cursor-dev), or direct `exec` / standalone session, to avoid TRL timeout / session lifecycle killing the process. |
| **Short Cursor agent via TRL** | If you must run `agent` or `cursor agent` through TRL, set `timeout_s` high (e.g. 600), or `timeout_s: 0` for no timeout, and **do not** destroy the session until the task completes. |
| **Cursor IDE chat vs terminal agent** | These are different processes. Cursor IDE chat and a terminal `agent` / `cursor agent` run do not usually interfere. If Cursor enforces a single agent instance, behavior may differ. |

### Why

TRL owns its session process tree. On `session.destroy`, timeout, or daemon shutdown, child processes (including Cursor agent) are terminated. This is by design. In current v1 behavior:

- If `exec.run` command looks like `cursor agent ...` or `agent "..."` / `agent --print` and no `timeout_s` is provided, TRL applies a safer default timeout of at least 600s.
- If `timeout_s` is explicitly set to `0`, timeout is disabled for that command.
- `session.destroy` supports `force`; destroying a running session without `force: true` returns `SESSION_BUSY`.

---

## Error Handling Guide

### Structured Error Responses

Every error from TRL includes a code and message:

```json
{"ok": false, "error": {"code": "SESSION_NOT_FOUND", "message": "..."}}
```

### Error Recovery Strategies

| Error Code | What Happened | Agent Should... |
|-----------|---------------|----------------|
| `SESSION_NOT_FOUND` | Session was destroyed or never existed | Create a new session |
| `SESSION_BUSY` | Another command is running | Wait and retry, or use a different session |
| `COMMAND_TIMEOUT` | Command exceeded time limit | Report timeout to user; session is still alive, can retry with longer timeout |
| `COMMAND_FAILED` | Non-zero exit code | Read stderr, diagnose, possibly retry with fixes |
| `INVALID_PARAMS` | Bad request format | Fix the request (bug in agent code) |
| `INTERNAL_ERROR` | Runtime crashed internally | Log it, create new session, retry |
| `AUTH_FAILED` | Bad token | Check `TRL_AUTH_TOKEN` is set correctly |

### Retry Logic

```python
async def exec_with_retry(session_id, command, max_retries=3):
    for attempt in range(max_retries):
        result = send_request("exec.run", {
            "session_id": session_id,
            "command": command
        })
        if result["ok"]:
            return result["data"]

        error_code = result["error"]["code"]

        if error_code == "SESSION_NOT_FOUND":
            session_id = create_new_session()  # Recreate
            continue
        elif error_code == "SESSION_BUSY":
            await asyncio.sleep(2 ** attempt)  # Backoff
            continue
        elif error_code == "COMMAND_TIMEOUT":
            return result  # Don't retry timeouts by default
        else:
            raise RuntimeError(f"Unrecoverable: {result['error']}")

    raise RuntimeError(f"Max retries exceeded for: {command}")
```

---

## Environment & Secrets Best Practices

### Passing Secrets to Commands

```python
# DO: Pass secrets at session or command level
send_request("session.create", {
    "env": {
        "DATABASE_URL": os.environ["DATABASE_URL"],
        "API_KEY": os.environ["API_KEY"]
    }
})

# DON'T: Embed secrets in command strings
send_request("exec.run", {
    "command": f"curl -H 'Authorization: Bearer {secret}' ..."  # BAD!
})

# DO: Use env vars in commands
send_request("exec.run", {
    "command": "curl -H \"Authorization: Bearer $API_KEY\" ...",
    "env": {"API_KEY": secret}  # Passed safely via env
})
```

### Principle: Secrets in Env, Not in Commands

Commands are logged, echoed, and visible in `ps` output. Environment variables are not. Always prefer env vars for sensitive data.

---

## Health Monitoring

### Ping Check

```python
def check_runtime_health():
    try:
        result = send_request("system.ping")
        if result["ok"]:
            return True, result["data"]["uptime_s"]
    except (ConnectionRefusedError, TimeoutError):
        return False, None
```

### Stats Monitoring

```python
def check_runtime_stats():
    result = send_request("system.stats")
    stats = result["data"]

    if stats["active_sessions"] > 50:
        warn("Too many active sessions — consider cleanup")

    return stats
```

### Agent Startup Checklist

Before an agent starts executing commands:

1. **Ping the runtime** — is it alive?
2. **List existing sessions** — any leftover from previous runs? Clean up or reuse.
3. **Check stats** — is the runtime healthy (not overloaded)?
4. **Create session(s)** — set up the execution environment(s) needed.

```python
async def agent_startup():
    # 1. Health check
    healthy, uptime = check_runtime_health()
    if not healthy:
        raise RuntimeError("TRL is not running — start it first")

    # 2. Clean up stale sessions
    sessions = send_request("session.list")["data"]["sessions"]
    for s in sessions:
        if s["name"] and s["name"].startswith("agent-"):
            send_request("session.destroy", {"session_id": s["session_id"]})

    # 3. Create fresh session
    result = send_request("session.create", {
        "name": "agent-main",
        "shell": "/bin/zsh",
        "env": load_agent_env()
    })
    return result["data"]["session_id"]
```

---

## Multi-Runtime (L2 — Future)

When multiple runtimes exist, the agent must choose which one to use:

```python
RUNTIMES = {
    "local": {"socket": "/tmp/trl-local.sock"},
    "docker": {"socket": "/tmp/trl-docker.sock"},
    "remote": {"http": "http://build-server:9100", "token": "..."},
}

def pick_runtime(task):
    """Choose runtime based on task requirements."""
    if task.needs_gpu:
        return RUNTIMES["remote"]
    elif task.needs_isolation:
        return RUNTIMES["docker"]
    else:
        return RUNTIMES["local"]
```

This pattern is forward-looking — build for L1 (single runtime) but keep the interface clean enough that swapping in multiple runtimes later is just a routing change.

---

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Not destroying sessions | Memory leak, resource exhaustion | Always clean up. Use try/finally. |
| Ignoring stderr | Missing warnings, error context | Always read and log stderr, even on success |
| Hardcoding session IDs | Breaks if session is recreated | Always use the ID returned by `session.create` |
| Not handling timeouts | Agent hangs forever | Always set `timeout_s`. Have a fallback. |
| Putting secrets in commands | Visible in logs and `ps` | Use `env` parameter instead |
| Assuming session state | Session may have been destroyed externally | Check for `SESSION_NOT_FOUND` and recreate |
