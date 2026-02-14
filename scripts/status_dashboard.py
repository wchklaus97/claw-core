#!/usr/bin/env python3
"""
Status dashboard: display claw_core sessions, OpenClaw cron jobs, and recent activity.
Usage: status_dashboard.py [--socket PATH] [--cron-file PATH]
"""
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import uuid
from datetime import datetime
from pathlib import Path

SOCKET = os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock")
CRON_FILE = os.path.expanduser("~/.openclaw/cron/jobs.json")


def send_claw_core(method: str, params: dict | None = None) -> dict:
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


def get_sessions() -> list:
    if not os.path.exists(SOCKET):
        return []
    r = send_claw_core("session.list")
    if not r.get("ok"):
        return []
    return r.get("data", {}).get("sessions", [])


def get_stats() -> dict:
    if not os.path.exists(SOCKET):
        return {}
    r = send_claw_core("system.stats")
    if not r.get("ok"):
        return {}
    return r.get("data", {})


def get_cron_jobs() -> list:
    if not os.path.exists(CRON_FILE):
        return []
    try:
        with open(CRON_FILE, "r") as f:
            data = json.load(f)
        return data.get("jobs", [])
    except:
        return []


def format_schedule(sched: dict) -> str:
    kind = sched.get("kind", "?")
    if kind == "at":
        at = sched.get("at", "?")
        return f"at {at}"
    if kind == "cron":
        expr = sched.get("expr", "?")
        tz = sched.get("tz")
        return f"cron {expr}" + (f" ({tz})" if tz else "")
    if kind == "every":
        ms = sched.get("everyMs", 0)
        if ms < 60000:
            return f"every {ms//1000}s"
        if ms < 3600000:
            return f"every {ms//60000}m"
        return f"every {ms//3600000}h"
    return kind


def main() -> int:
    ap = argparse.ArgumentParser(description="Display claw_core sessions, cron jobs, and recent activity.")
    ap.add_argument("--socket", default=os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock"), help="claw_core socket path")
    ap.add_argument("--cron-file", default=os.path.expanduser("~/.openclaw/cron/jobs.json"), help="OpenClaw cron jobs.json path")
    args = ap.parse_args()

    global SOCKET, CRON_FILE
    SOCKET = args.socket
    CRON_FILE = args.cron_file

    print("=" * 60)
    print(" STATUS DASHBOARD")
    print("=" * 60)

    # claw_core runtime
    if os.path.exists(SOCKET):
        stats = get_stats()
        print("\n[claw_core Runtime]")
        print(f"  Status:       RUNNING")
        print(f"  Uptime:       {stats.get('uptime_s', '?')}s")
        print(f"  Commands run: {stats.get('total_commands_run', '?')}")
        print(f"  Active sessions: {stats.get('active_sessions', '?')}")
        open_fds = stats.get('open_fds')
        if open_fds:
            health = "⚠️ HIGH" if open_fds > 1000 else "OK"
            print(f"  Open FDs:     {open_fds} ({health})")
    else:
        print("\n[claw_core Runtime]")
        print(f"  Status:       NOT RUNNING")
        print(f"\n  ✗ The claw_core runtime is currently not running (its socket {SOCKET} is absent).")
        print(f"     You can start it with:")
        print(f"")
        print(f"     claw_core --daemon")
        print(f"")

    # Sessions
    sessions = get_sessions()
    print(f"\n[claw_core Sessions] ({len(sessions)} active)")
    if sessions:
        for s in sessions:
            name = s.get("name") or "(no name)"
            state = s.get("state", "?")
            cwd = s.get("working_dir", "?")
            last = s.get("last_activity", s.get("created_at", "?"))
            print(f"  • {s.get('session_id')} [{state}] name={name}")
            print(f"    cwd: {cwd}")
            print(f"    last activity: {format_time_ago(last)}")
    else:
        print("  (no sessions)")

    # Cron jobs
    jobs = get_cron_jobs()
    enabled_jobs = [j for j in jobs if j.get("enabled", True)]
    print(f"\n[Cron Jobs] ({len(enabled_jobs)} enabled / {len(jobs)} total)")
    if enabled_jobs:
        for job in enabled_jobs:
            name = job.get("name", "(no name)")
            schedule = format_schedule(job.get("schedule", {}))
            target = job.get("sessionTarget", "?")
            next_run = job.get("nextRun") or job.get("schedule", {}).get("at")
            next_str = format_time_ago(next_run) if next_run else "pending"
            print(f"  • {job.get('jobId', '?')[:12]}... [{target}] {name}")
            print(f"    schedule: {schedule}")
            print(f"    next run: {next_str}")
    else:
        print("  (no enabled cron jobs)")

    # Recent activity (last 5 session files by mtime)
    sessions_dir = Path.home() / ".openclaw" / "agents" / "main" / "sessions"
    if sessions_dir.exists():
        recent = sorted(sessions_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:5]
        print(f"\n[Recent Activity] (last 5 sessions)")
        for p in recent:
            mtime = datetime.fromtimestamp(p.stat().st_mtime)
            ago = format_time_ago(mtime.isoformat())
            print(f"  • {p.name[:16]}... (modified {ago})")
    else:
        print(f"\n[Recent Activity]")
        print("  (sessions directory not found)")

    print("\n" + "=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
