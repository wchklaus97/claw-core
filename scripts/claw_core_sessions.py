#!/usr/bin/env python3
"""
Manage claw_core sessions by name or id. For use from Telegram/OpenClaw agent.
Usage:
  claw_core_sessions.py list
  claw_core_sessions.py create --name LABEL [--cwd DIR] [--timeout N]
  claw_core_sessions.py run --name LABEL|--session-id ID -- COMMAND...
  claw_core_sessions.py destroy --name LABEL|--session-id ID [--force]
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import uuid

SOCKET = os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def send(method: str, params: dict | None = None) -> dict:
    req = {"id": str(uuid.uuid4()), "method": method, "params": params or {}}
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        s.settimeout(60)
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


def resolve_session_by_name(name: str) -> str | None:
    r = send("session.list")
    if not r.get("ok"):
        return None
    for s in r.get("data", {}).get("sessions", []):
        if (s.get("name") or "").strip() == name.strip():
            return s.get("session_id")
    return None


def cmd_list() -> int:
    r = send("session.list")
    if not r.get("ok"):
        print("session.list failed:", r.get("error"), file=sys.stderr)
        return 1
    sessions = r.get("data", {}).get("sessions", [])
    if not sessions:
        print("No sessions.")
        return 0
    for s in sessions:
        name = s.get("name") or "(no name)"
        print(f"  {s.get('session_id')}  name={name}  state={s.get('state')}  cwd={s.get('working_dir')}")
    return 0


def cmd_create(args) -> int:
    cwd = args.cwd or os.getcwd()
    env = {}
    if os.environ.get("PATH"):
        env["PATH"] = os.environ["PATH"]
    if os.environ.get("HOME"):
        env["HOME"] = os.environ["HOME"]
    params = {
        "working_dir": cwd,
        "shell": "/bin/zsh",
        "name": args.name,
        "timeout_s": args.timeout or 300,
    }
    if env:
        params["env"] = env
    r = send("session.create", params)
    if not r.get("ok"):
        err = r.get("error", {})
        print(f"session.create failed: {err.get('code')} {err.get('message')}", file=sys.stderr)
        return 2
    data = r["data"]
    print(f"Created session {data['session_id']} name={data.get('name')} cwd={data['working_dir']}")
    return 0


def cmd_run(args) -> int:
    session_id = args.session_id
    if not session_id and args.name:
        session_id = resolve_session_by_name(args.name)
    if not session_id:
        print("No session_id or name given, or name not found.", file=sys.stderr)
        return 3
    command = " ".join(args.command)
    run_params = {"session_id": session_id, "command": command}
    if args.timeout and args.timeout > 0:
        run_params["timeout_s"] = args.timeout
    r = send("exec.run", run_params)
    if not r.get("ok"):
        err = r.get("error", {})
        print(f"exec.run failed: {err.get('code')} {err.get('message')}", file=sys.stderr)
        return 4
    data = r.get("data", {})
    out = data.get("stdout", "")
    err = data.get("stderr", "")
    if out:
        sys.stdout.write(out)
        if not out.endswith("\n"):
            sys.stdout.write("\n")
        sys.stdout.flush()
    if err:
        sys.stderr.write(err)
        if not err.endswith("\n"):
            sys.stderr.write("\n")
        sys.stderr.flush()
    return data.get("exit_code", 0) if isinstance(data.get("exit_code"), int) else 0


def cmd_destroy(args) -> int:
    session_id = args.session_id
    if not session_id and args.name:
        session_id = resolve_session_by_name(args.name)
    if not session_id:
        print("No session_id or name given, or name not found.", file=sys.stderr)
        return 5
    r = send("session.destroy", {"session_id": session_id, "force": args.force})
    if not r.get("ok"):
        err = r.get("error", {})
        print(f"session.destroy failed: {err.get('code')} {err.get('message')}", file=sys.stderr)
        return 6
    print(f"Destroyed session {session_id}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Manage claw_core sessions (list/create/run/destroy) by name or id.")
    ap.add_argument("--socket", default=os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock"), help="claw_core socket path")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all sessions (id, name, state, cwd)")

    p_create = sub.add_parser("create", help="Create a named session")
    p_create.add_argument("--name", required=True, help="Session label/name")
    p_create.add_argument("--cwd", default=None, help="Working directory")
    p_create.add_argument("--timeout", type=int, default=300, help="Default command timeout (seconds)")

    p_run = sub.add_parser("run", help="Run a command in a session (by name or session_id)")
    p_run.add_argument("--name", help="Session name/label")
    p_run.add_argument("--session-id", help="Session id (e.g. s-xxxxxxxx)")
    p_run.add_argument("--timeout", type=int, default=0, help="Command timeout (0=session default)")
    p_run.add_argument("command", nargs="+", help="Command to run")

    p_destroy = sub.add_parser("destroy", help="Destroy a session")
    p_destroy.add_argument("--name", help="Session name/label")
    p_destroy.add_argument("--session-id", help="Session id")
    p_destroy.add_argument("--force", action="store_true", help="Force destroy if running")

    args = ap.parse_args()
    global SOCKET
    SOCKET = args.socket
    if not os.path.exists(SOCKET):
        print(f"Socket not found: {SOCKET}", file=sys.stderr)
        return 1

    if args.cmd == "list":
        return cmd_list()
    if args.cmd == "create":
        return cmd_create(args)
    if args.cmd == "run":
        return cmd_run(args)
    if args.cmd == "destroy":
        return cmd_destroy(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
