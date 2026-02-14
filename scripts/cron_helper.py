#!/usr/bin/env python3
"""
Simple cron job helper for OpenClaw (avoids complex tool call params).
Usage:
  cron_helper.py add-cursor-daily --name NAME --hour H --message "用 Cursor 做：..." --telegram-chat CHAT_ID
  cron_helper.py add-session-weekly --name NAME --session SESSION_NAME --command CMD --telegram-chat CHAT_ID
  cron_helper.py list
  cron_helper.py remove --job-id ID
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

CRON_FILE = Path.home() / ".openclaw" / "cron" / "jobs.json"


def load_cron_file() -> dict:
    if not CRON_FILE.exists():
        return {"jobs": []}
    with open(CRON_FILE, "r") as f:
        return json.load(f)


def save_cron_file(data: dict):
    CRON_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CRON_FILE, "w") as f:
        json.dump(data, f, indent=2)


def generate_job_id() -> str:
    import uuid
    return f"job-{uuid.uuid4().hex[:12]}"


def cmd_list() -> int:
    data = load_cron_file()
    jobs = data.get("jobs", [])
    if not jobs:
        print("No cron jobs.")
        return 0
    for j in jobs:
        enabled = "✓" if j.get("enabled", True) else "✗"
        name = j.get("name", "(no name)")
        schedule = j.get("schedule", {})
        kind = schedule.get("kind", "?")
        expr_or_at = schedule.get("expr") or schedule.get("at") or schedule.get("everyMs")
        print(f"{enabled} {j.get('jobId', '?')[:12]}... {name} ({kind}: {expr_or_at})")
    return 0


def cmd_add_cursor_daily(args) -> int:
    job_id = generate_job_id()
    now = datetime.now(timezone.utc)
    # Calculate next run at the specified hour (Hong Kong time = UTC+8)
    # Simplified: schedule at args.hour in UTC (user can adjust tz in job if needed)
    hour = args.hour or 9
    schedule = {
        "kind": "cron",
        "expr": f"0 {hour} * * *",
        "tz": "Asia/Hong_Kong"
    }
    job = {
        "jobId": job_id,
        "name": args.name or "Cursor daily check",
        "schedule": schedule,
        "sessionTarget": "isolated",
        "payload": {
            "kind": "agentTurn",
            "message": args.message or "用 Cursor 做：檢查 workspace 依賴"
        },
        "delivery": {
            "mode": "announce",
            "channel": "telegram",
            "to": str(args.telegram_chat)
        },
        "enabled": True,
        "createdAt": now.isoformat()
    }
    data = load_cron_file()
    data["jobs"].append(job)
    save_cron_file(data)
    print(f"Created cron job: {job_id} ({args.name})")
    print(f"Schedule: daily at {hour}:00 Asia/Hong_Kong")
    print(f"Will announce to Telegram chat: {args.telegram_chat}")
    return 0


def cmd_add_session_weekly(args) -> int:
    job_id = generate_job_id()
    now = datetime.now(timezone.utc)
    day = args.day or 1  # Monday = 1
    hour = args.hour or 9
    schedule = {
        "kind": "cron",
        "expr": f"0 {hour} * * {day}",
        "tz": "Asia/Hong_Kong"
    }
    message = f"在 claw session {args.session} 跑 {args.command}" if args.session and args.command else args.message
    job = {
        "jobId": job_id,
        "name": args.name or "Weekly session command",
        "schedule": schedule,
        "sessionTarget": "isolated",
        "payload": {
            "kind": "agentTurn",
            "message": message
        },
        "delivery": {
            "mode": "announce",
            "channel": "telegram",
            "to": str(args.telegram_chat)
        },
        "enabled": True,
        "createdAt": now.isoformat()
    }
    data = load_cron_file()
    data["jobs"].append(job)
    save_cron_file(data)
    print(f"Created cron job: {job_id} ({args.name})")
    print(f"Schedule: weekly day {day} at {hour}:00 Asia/Hong_Kong")
    print(f"Will announce to Telegram chat: {args.telegram_chat}")
    return 0


def cmd_remove(args) -> int:
    data = load_cron_file()
    original_count = len(data["jobs"])
    data["jobs"] = [j for j in data["jobs"] if j.get("jobId") != args.job_id]
    if len(data["jobs"]) == original_count:
        print(f"Job not found: {args.job_id}", file=sys.stderr)
        return 1
    save_cron_file(data)
    print(f"Removed job: {args.job_id}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Simple cron helper for OpenClaw.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all cron jobs")

    p_daily = sub.add_parser("add-cursor-daily", help="Add daily Cursor job (announce to Telegram)")
    p_daily.add_argument("--name", required=True, help="Job name")
    p_daily.add_argument("--hour", type=int, default=9, help="Hour (0-23, default 9)")
    p_daily.add_argument("--message", required=True, help="Cursor task message (e.g. '用 Cursor 做：...')")
    p_daily.add_argument("--telegram-chat", required=True, help="Telegram chat ID")

    p_weekly = sub.add_parser("add-session-weekly", help="Add weekly claw session job (announce to Telegram)")
    p_weekly.add_argument("--name", required=True, help="Job name")
    p_weekly.add_argument("--session", help="Session name")
    p_weekly.add_argument("--command", help="Command to run in session")
    p_weekly.add_argument("--message", help="Full message (alternative to --session + --command)")
    p_weekly.add_argument("--day", type=int, default=1, help="Day of week (1=Mon, 7=Sun, default 1)")
    p_weekly.add_argument("--hour", type=int, default=9, help="Hour (0-23, default 9)")
    p_weekly.add_argument("--telegram-chat", required=True, help="Telegram chat ID")

    p_remove = sub.add_parser("remove", help="Remove a cron job by id")
    p_remove.add_argument("--job-id", required=True, help="Job ID to remove")

    args = ap.parse_args()

    if args.cmd == "list":
        return cmd_list()
    if args.cmd == "add-cursor-daily":
        return cmd_add_cursor_daily(args)
    if args.cmd == "add-session-weekly":
        return cmd_add_session_weekly(args)
    if args.cmd == "remove":
        return cmd_remove(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
