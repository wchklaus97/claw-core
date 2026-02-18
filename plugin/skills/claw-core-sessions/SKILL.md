# SKILL.md — Claw Core Sessions

> List and manage claw_core terminal sessions. Use when the agent needs to inspect or clean up sessions.

---

## What This Skill Is For

- **List sessions** — see active sessions (name, id, working_dir, state)
- **Create session** — create a named session for persistent work
- **Run in session** — execute a command in an existing session (by name or id)
- **Destroy session** — terminate a session when done or stuck

---

## How To Use

The plugin ships `claw_core_sessions.py`. Always use this script — do NOT use raw `socat` or JSON-RPC directly.

### List all sessions

```bash
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py list
```

Output example:

```
  s-a71da6ce  name=timeout-test3  state=idle  cwd=/tmp
  s-6db019de  name=timeout-test2  state=idle  cwd=/tmp
```

If no sessions exist, prints `No sessions.`

### Create a named session

```bash
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py create --name my-session --cwd /path/to/dir --timeout 300
```

### Run a command in a session

```bash
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py run --name my-session -- ls -la
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py run --session-id s-a71da6ce -- echo hello
```

### Destroy a session

```bash
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py destroy --name my-session --force
python3 $PLUGIN_ROOT/scripts/claw_core_sessions.py destroy --session-id s-a71da6ce --force
```

---

## Error Handling

- If claw_core daemon is not running: `Socket not found: /tmp/trl.sock`
- If session name not found: `No session_id or name given, or name not found.`
- Start daemon first: `openclaw clawcore start`

---

## Config

- Socket path: `$CLAW_CORE_SOCKET` (default `/tmp/trl.sock`)
- Override: `python3 claw_core_sessions.py --socket /path/to/sock list`
