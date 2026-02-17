#!/usr/bin/env python3
"""
Status dashboard: display claw_core sessions, OpenClaw cron jobs, backend status,
bot agents, and recent activity.
Usage: status_dashboard.py [--socket PATH] [--cron-file PATH]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path

SOCKET = os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock")
CRON_FILE = os.path.expanduser("~/.openclaw/cron/jobs.json")
OPENCLAW_CONFIG = Path.home() / ".openclaw" / "openclaw.json"


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
    except Exception:
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
    except Exception:
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


def check_binary(name: str) -> tuple[bool, str]:
    """Check if a binary is installed and return (available, version_or_path)."""
    path = shutil.which(name)
    if not path:
        return False, "not found"
    try:
        result = subprocess.run(
            [path, "--version"],
            capture_output=True, text=True, timeout=5,
        )
        version = result.stdout.strip().split("\n")[0] or result.stderr.strip().split("\n")[0] or "unknown"
        return True, version
    except Exception:
        return True, path


def get_picoclaw_config() -> dict:
    """Read PicoClaw config for model/provider info."""
    for config_path in [
        Path.home() / ".picoclaw" / "workspace" / "config.json",
        Path.home() / ".picoclaw" / "config.json",
    ]:
        if config_path.exists():
            try:
                with open(config_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
    return {}


def get_bot_agents() -> list[dict]:
    """Read configured bot agents from openclaw.json."""
    if not OPENCLAW_CONFIG.exists():
        return []
    try:
        with open(OPENCLAW_CONFIG, "r") as f:
            config = json.load(f)
        return config.get("agents", {}).get("list", [])
    except Exception:
        return []


def get_telegram_accounts() -> list[dict]:
    """Read configured Telegram accounts from openclaw.json."""
    if not OPENCLAW_CONFIG.exists():
        return []
    try:
        with open(OPENCLAW_CONFIG, "r") as f:
            config = json.load(f)
        return config.get("channels", {}).get("telegram", {}).get("accounts", [])
    except Exception:
        return []


def main() -> int:
    ap = argparse.ArgumentParser(description="Display claw_core sessions, backends, bot agents, cron jobs, and recent activity.")
    ap.add_argument("--socket", default=os.environ.get("CLAW_CORE_SOCKET", "/tmp/trl.sock"), help="claw_core socket path")
    ap.add_argument("--cron-file", default=os.path.expanduser("~/.openclaw/cron/jobs.json"), help="OpenClaw cron jobs.json path")
    args = ap.parse_args()

    global SOCKET, CRON_FILE
    SOCKET = args.socket
    CRON_FILE = args.cron_file

    print("=" * 60)
    print(" STATUS DASHBOARD")
    print("=" * 60)

    # ---------------------------------------------------------------
    # Backends
    # ---------------------------------------------------------------
    print("\n[Backends]")

    # Claw Core
    if os.path.exists(SOCKET):
        stats = get_stats()
        print(f"  ✓ Claw Core      RUNNING  (uptime: {stats.get('uptime_s', '?')}s, commands: {stats.get('total_commands_run', '?')})")
    else:
        print(f"  ✗ Claw Core      NOT RUNNING  (socket: {SOCKET})")

    # Cursor CLI
    cursor_ok, cursor_info = check_binary(os.environ.get("CURSOR_PATH", "cursor"))
    if cursor_ok:
        print(f"  ✓ Cursor CLI     {cursor_info}")
    else:
        print(f"  ✗ Cursor CLI     not installed")

    # PicoClaw
    pico_ok, pico_info = check_binary(os.environ.get("PICOCLAW_PATH", "picoclaw"))
    if pico_ok:
        pico_config = get_picoclaw_config()
        model = pico_config.get("model", "?")
        print(f"  ✓ PicoClaw       {pico_info}  (model: {model})")
    else:
        print(f"  ✗ PicoClaw       not installed  (https://github.com/sipeed/picoclaw)")

    # ---------------------------------------------------------------
    # Bot Agents
    # ---------------------------------------------------------------
    agents = get_bot_agents()
    accounts = get_telegram_accounts()
    account_map = {a.get("id"): a for a in accounts}

    print(f"\n[Bot Agents] ({len(agents)} configured)")
    if agents:
        for agent in agents:
            agent_id = agent.get("id", "?")
            workspace = agent.get("workspace", "?")
            tools_profile = agent.get("tools", {}).get("profile", "?")
            # Find matching Telegram account
            tg_info = ""
            for acc in accounts:
                # Match by convention: image-bot→artist, qa-bot→assistant, dev-bot→developer
                # Or check bindings
                pass
            has_workspace = Path(workspace).exists() if workspace != "?" else False
            ws_status = "✓" if has_workspace else "✗"
            print(f"  🤖 {agent_id:<14} [profile: {tools_profile}]  workspace: {ws_status}")
            print(f"     {workspace}")
    else:
        print("  (no agents configured)")
        print("  Run: openclaw clawcore setup-bots")

    if accounts:
        print(f"\n[Telegram Accounts] ({len(accounts)} configured)")
        for acc in accounts:
            acc_id = acc.get("id", "?")
            has_token = bool(acc.get("botToken")) and not acc.get("botToken", "").startswith("<")
            token_status = "✓ token set" if has_token else "⚠ needs token"
            print(f"  📱 {acc_id:<14} [{token_status}]")

    # ---------------------------------------------------------------
    # claw_core Runtime Details
    # ---------------------------------------------------------------
    if os.path.exists(SOCKET):
        stats = get_stats()
        print("\n[claw_core Runtime]")
        print(f"  Status:          RUNNING")
        print(f"  Uptime:          {stats.get('uptime_s', '?')}s")
        print(f"  Commands run:    {stats.get('total_commands_run', '?')}")
        print(f"  Active sessions: {stats.get('active_sessions', '?')}")
        open_fds = stats.get("open_fds")
        if open_fds:
            health = "⚠️ HIGH" if open_fds > 1000 else "OK"
            print(f"  Open FDs:        {open_fds} ({health})")

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

    # Recent activity (last 5 session files by mtime, check all agent dirs)
    found_recent = False
    for agent_dir_name in ["main", "artist", "assistant", "developer"]:
        sessions_dir = Path.home() / ".openclaw" / "agents" / agent_dir_name / "sessions"
        if sessions_dir.exists():
            recent = sorted(sessions_dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:3]
            if recent:
                if not found_recent:
                    print(f"\n[Recent Activity]")
                    found_recent = True
                print(f"  [{agent_dir_name}]")
                for p in recent:
                    mtime = datetime.fromtimestamp(p.stat().st_mtime)
                    ago = format_time_ago(mtime.isoformat())
                    print(f"    • {p.name[:16]}... (modified {ago})")

    if not found_recent:
        print(f"\n[Recent Activity]")
        print("  (no session history found)")

    # ---------------------------------------------------------------
    # Team Sessions
    # ---------------------------------------------------------------
    teams_dir = Path(os.environ.get("OPENCLAW_TEAMS_DIR", Path.home() / ".openclaw" / "teams"))
    if teams_dir.exists():
        teams = []
        for d in sorted(teams_dir.iterdir()):
            team_file = d / "team.json"
            tasks_file = d / "tasks.json"
            if team_file.exists():
                try:
                    with open(team_file, "r") as f:
                        team = json.load(f)
                    task_counts = {"todo": 0, "in_progress": 0, "done": 0, "blocked": 0}
                    if tasks_file.exists():
                        with open(tasks_file, "r") as f:
                            tasks = json.load(f).get("tasks", [])
                        for t in tasks:
                            s = t.get("status", "todo")
                            if s in task_counts:
                                task_counts[s] += 1
                    team["_task_counts"] = task_counts
                    team["_total_tasks"] = sum(task_counts.values())
                    teams.append(team)
                except Exception:
                    pass

        if teams:
            active = [t for t in teams if t.get("status") == "active"]
            closed = [t for t in teams if t.get("status") == "closed"]
            print(f"\n[Team Sessions] ({len(active)} active, {len(closed)} closed)")
            for t in active:
                tc = t["_task_counts"]
                total = t["_total_tasks"]
                agents = ", ".join(t.get("agents", []))
                group = t.get("telegram_group_id", "-")[:15] or "-"
                print(f"  🤝 {t['name']:<16} [{t.get('lead', '?')} lead]  group: {group}")
                print(f"     Agents: {agents}")
                print(f"     Tasks: {total} total (✅{tc['done']} 🔄{tc['in_progress']} 📋{tc['todo']} 🚫{tc['blocked']})")
        else:
            print(f"\n[Team Sessions]")
            print("  (no teams)")
    else:
        print(f"\n[Team Sessions]")
        print("  (no teams)")

    print("\n" + "=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
