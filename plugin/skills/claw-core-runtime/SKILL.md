# SKILL.md — Claw Core Runtime (Exec Wrapper)

> Use claw_core for session-managed command execution instead of raw exec. OpenClaw agents should prefer this when claw_core is available.

---

## What This Skill Is For

When an agent needs to run shell commands, use **claw_core** (Terminal Runtime Layer) instead of direct `exec`:

- **Session isolation** — each command runs in a managed session
- **Timeout enforcement** — prevents runaway processes
- **Structured output** — stdout, stderr, exit_code, duration
- **Graceful fallback** — if claw_core is unavailable, fall back to normal exec

---

## How to Run Commands via claw_core

### Wrapper Script (plugin-installed)

The plugin ships `claw_core_exec.py`. When installed at `$PLUGIN_ROOT`:

```bash
python3 $PLUGIN_ROOT/scripts/claw_core_exec.py --cwd /path/to/dir --timeout 60 -- ls -la
```

Or with `CLAW_CORE_SOCKET` set:

```bash
CLAW_CORE_SOCKET=/tmp/trl.sock python3 claw_core_exec.py --timeout 60 -- npm install
```

### One-Shot Pattern

The wrapper creates a session, runs the command, then destroys the session. No need to manage sessions manually for simple commands.

### When claw_core Is Unavailable

- Check socket: `ls -la /tmp/trl.sock` (or `$CLAW_CORE_SOCKET`)
- Start daemon: `openclaw clawcore start` or via plugin boot hook
- Fall back to normal exec if claw_core is down

---

## Config (OpenClaw)

Enable this skill and ensure exec tool uses the wrapper when available. Plugin config (`plugins.entries.claw-core.config`):

- `socketPath`: Unix socket path (default `/tmp/trl.sock`)
- `binaryPath`: path to claw_core binary (optional)
