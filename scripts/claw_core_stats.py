#!/usr/bin/env python3
"""Query claw_core runtime: system.ping and system.stats. Use to verify requests hit the runtime."""
from __future__ import annotations

import json
import os
import socket
import sys
import uuid

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


def main() -> int:
    if not os.path.exists(SOCKET):
        print(f"Socket not found: {SOCKET}", file=sys.stderr)
        print("Start claw_core first: cargo run -- --socket-path /tmp/trl.sock", file=sys.stderr)
        return 1

    ping = send("system.ping")
    if not ping.get("ok"):
        print("system.ping failed:", ping, file=sys.stderr)
        return 2

    stats = send("system.stats")
    if not stats.get("ok"):
        print("system.stats failed:", stats, file=sys.stderr)
        return 3

    d = stats.get("data", {})
    print("claw_core runtime:")
    print("  version:     ", ping.get("data", {}).get("version", "?"))
    print("  uptime_s:    ", d.get("uptime_s", "?"))
    print("  active_sessions: ", d.get("active_sessions", "?"))
    print("  total_commands_run:", d.get("total_commands_run", "?"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
