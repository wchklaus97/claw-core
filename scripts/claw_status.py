#!/usr/bin/env python3
"""Quick claw_core status check (runtime + sessions only). For Telegram command: 'claw status'."""
from __future__ import annotations

import json
import os
import socket
import sys
import uuid
from datetime import datetime

SOCKET = os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock")


def send(method: str, params: dict | None = None) -> dict:
    req = {"id": str(uuid.uuid4()), "method": method, "params": params or {}}
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        s.settimeout(5)
        s.connect(SOCKET)
        s.sendall((json.dumps(req) + "\n").encode())
        buf = b""
        while b"\n" not in buf:
            chunk = s.recv(4096)
            if not chunk:
                break
            buf += chunk
        return json.loads(buf.decode().strip())
    finally:
        s.close()


def format_time_ago(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        delta = datetime.now(dt.tzinfo) - dt
        secs = int(delta.total_seconds())
        if secs < 60:
            return f"{secs}s ago"
        if secs < 3600:
            return f"{secs//60}m ago"
        if secs < 86400:
            return f"{secs//3600}h ago"
        return f"{secs//86400}d ago"
    except:
        return iso_str


def main() -> int:
    print("=" * 50)
    print(" CLAW_CORE STATUS")
    print("=" * 50)

    if not os.path.exists(SOCKET):
        print("\n✗ The claw_core runtime is currently not running (its socket /tmp/trl.sock is absent).")
        print("   You can start it with:")
        print("")
        print("   claw_core --daemon")
        print("")
        return 1

    # Get stats
    stats_resp = send("system.stats")
    if not stats_resp.get("ok"):
        print("\n❌ claw_core not responding")
        return 2
    
    stats = stats_resp.get("data", {})
    
    # Get sessions
    sessions_resp = send("session.list")
    sessions = sessions_resp.get("data", {}).get("sessions", []) if sessions_resp.get("ok") else []

    # Display
    print("\n[Runtime]")
    print(f"  Status:    ✅ RUNNING")
    print(f"  Uptime:    {stats.get('uptime_s', '?')}s")
    print(f"  Commands:  {stats.get('total_commands_run', '?')}")
    
    open_fds = stats.get('open_fds', 0)
    fd_health = "⚠️ HIGH" if open_fds > 1000 else "✅ OK"
    print(f"  Open FDs:  {open_fds} ({fd_health})")

    print(f"\n[Sessions] ({len(sessions)} active)")
    if sessions:
        for s in sessions:
            name = s.get("name") or "(no name)"
            state = s.get("state", "?")
            state_icon = "🔵" if state == "idle" else "🟢" if state == "running" else "⚪"
            print(f"  {state_icon} {s.get('session_id')} [{state}] name={name}")
            print(f"     cwd: {s.get('working_dir', '?')}")
            last = s.get("last_activity") or s.get("created_at", "?")
            print(f"     last: {format_time_ago(last)}")
    else:
        print("  (no active sessions)")

    print("\n" + "=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
