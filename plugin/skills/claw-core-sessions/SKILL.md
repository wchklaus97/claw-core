# SKILL.md — Claw Core Sessions

> List and manage claw_core terminal sessions. Use when the agent needs to inspect or clean up sessions.

---

## What This Skill Is For

- **List sessions** — see active sessions (name, id, working_dir, state)
- **Inspect session** — get details for a specific session
- **Destroy session** — terminate a session when done or stuck

---

## Protocol (claw_core socket)

Connect to `$CLAW_CORE_SOCKET` (default `/tmp/trl.sock`), send JSON-RPC:

### session.list

```json
{"id":"1","method":"session.list","params":{}}
```

Response:

```json
{"ok":true,"data":{"sessions":[{"session_id":"s-xxx","name":"build-env","working_dir":"/tmp/proj","state":"idle",...}]}}
```

### session.info

```json
{"id":"2","method":"session.info","params":{"session_id":"s-xxx"}}
```

### session.destroy

```json
{"id":"3","method":"session.destroy","params":{"session_id":"s-xxx","force":true}}
```

---

## CLI / Scripts

The plugin does not ship a sessions script; agents use the socket protocol directly or the claw repo's `claw_core_sessions.py` if available.
