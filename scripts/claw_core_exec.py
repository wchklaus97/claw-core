#!/usr/bin/env python3
"""
One-shot exec via claw_core (Terminal Runtime Layer).
Usage: claw_core_exec.py [--socket PATH] [--cwd DIR] [--timeout N] -- COMMAND...
Stdout/stderr/exit_code are forwarded from the runtime; this script exits with the command's exit code.
Requires: claw_core runtime listening on the socket (e.g. cargo run -- --socket-path /tmp/trl.sock).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid


def main() -> int:
    ap = argparse.ArgumentParser(description="Run a command via claw_core runtime (one-shot: create session, run, destroy).")
    ap.add_argument("--socket", default=os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock"), help="Unix socket path")
    ap.add_argument("--cwd", default=None, help="Working directory")
    ap.add_argument("--timeout", type=int, default=0, help="Command timeout in seconds (0 = none)")
    ap.add_argument("command", nargs="+", help="Command and args (or use -- then command)")
    args = ap.parse_args()

    socket_path = args.socket
    cwd = args.cwd or os.getcwd()
    timeout_s = args.timeout
    command = " ".join(args.command)

    try:
        import socket as sock
    except ImportError:
        print("socket module required", file=sys.stderr)
        return 127

    def send_request(method: str, params: dict | None = None) -> dict:
        req = {"id": str(uuid.uuid4()), "method": method, "params": params or {}}
        s = sock.socket(sock.AF_UNIX, sock.SOCK_STREAM)
        try:
            s.settimeout(60)
            s.connect(socket_path)
            s.sendall((json.dumps(req) + "\n").encode())
            buf = b""
            while b"\n" not in buf:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buf += chunk
            out = json.loads(buf.decode().strip())
            return out
        finally:
            s.close()

    # 1. Create session (pass PATH/HOME so session sees same env as gateway: cursor, timeout, etc.)
    create_params = {"working_dir": cwd, "shell": "/bin/zsh"}
    if timeout_s > 0:
        create_params["timeout_s"] = timeout_s
    env = {}
    if os.environ.get("PATH"):
        env["PATH"] = os.environ["PATH"]
    if os.environ.get("HOME"):
        env["HOME"] = os.environ["HOME"]
    if env:
        create_params["env"] = env
    resp = send_request("session.create", create_params)
    if not resp.get("ok"):
        err = resp.get("error", {})
        print(f"claw_core session.create failed: {err.get('code', '?')} {err.get('message', '')}", file=sys.stderr)
        return 1
    session_id = resp["data"]["session_id"]

    try:
        # 2. Run command
        run_params = {"session_id": session_id, "command": command}
        if timeout_s > 0:
            run_params["timeout_s"] = timeout_s
        resp = send_request("exec.run", run_params)
        if not resp.get("ok"):
            err = resp.get("error", {})
            code = err.get("code", "?")
            msg = err.get("message", "")
            print(f"claw_core exec.run failed: {code} {msg}", file=sys.stderr)
            return 2
        data = resp["data"]
        stdout_str = data.get("stdout", "")
        stderr_str = data.get("stderr", "")
        exit_code = data.get("exit_code", -1)
        if stdout_str:
            sys.stdout.write(stdout_str)
            if not stdout_str.endswith("\n"):
                sys.stdout.write("\n")
            sys.stdout.flush()
        if stderr_str:
            sys.stderr.write(stderr_str)
            if not stderr_str.endswith("\n"):
                sys.stderr.write("\n")
            sys.stderr.flush()
        return exit_code if isinstance(exit_code, int) else -1
    finally:
        send_request("session.destroy", {"session_id": session_id, "force": True})


if __name__ == "__main__":
    sys.exit(main())
