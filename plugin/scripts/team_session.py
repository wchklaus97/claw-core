#!/usr/bin/env python3
"""
Team Session Manager for Claw Core OpenClaw plugin.

Manages multi-agent team sessions inspired by Claude Code Agent Teams.
Agents collaborate via a shared task board and inter-agent messages,
coordinated through Telegram group chats.

State stored in: ~/.openclaw/teams/{team-name}/
  team.json     — team definition (agents, group, topics, repo)
  tasks.json    — shared task board
  messages.json — inter-agent message log

Usage:
  team_session.py create  --name NAME --group-id ID [--repo PATH] [--agents a,b,c] [--lead AGENT]
  team_session.py list
  team_session.py status  --name NAME [--json]
  team_session.py close   --name NAME

  team_session.py task-add    --name NAME --title TITLE [--assign-to AGENT] [--depends-on T001,T002]
  team_session.py task-claim  --name NAME --task-id ID --agent AGENT
  team_session.py task-update --name NAME --task-id ID --status STATUS [--notes NOTES]
  team_session.py task-list   --name NAME [--json]

  team_session.py message     --name NAME --from AGENT --to AGENT --body TEXT
  team_session.py messages    --name NAME [--json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

TEAMS_DIR = Path(os.environ.get("OPENCLAW_TEAMS_DIR", Path.home() / ".openclaw" / "teams"))

DEFAULT_AGENTS = ["artist", "assistant", "developer"]
DEFAULT_LEAD = "developer"

TASK_STATUSES = ["todo", "in_progress", "done", "blocked", "cancelled"]


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def team_dir(name: str) -> Path:
    """Get the directory for a team."""
    return TEAMS_DIR / name


def load_json(path: Path) -> dict:
    """Load JSON file or return empty dict."""
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return {}


def save_json(path: Path, data: dict) -> None:
    """Save JSON file with pretty formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


def now_iso() -> str:
    """Current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def gen_task_id(tasks: list) -> str:
    """Generate next task ID like T001, T002, etc."""
    existing = [t.get("id", "") for t in tasks]
    for i in range(1, 9999):
        tid = f"T{i:03d}"
        if tid not in existing:
            return tid
    return f"T{uuid.uuid4().hex[:6]}"


def gen_msg_id() -> str:
    """Generate a message ID."""
    return f"M{uuid.uuid4().hex[:8]}"


# -------------------------------------------------------------------
# Team CRUD
# -------------------------------------------------------------------

def cmd_create(args) -> int:
    """Create a new team session."""
    name = args.name
    td = team_dir(name)

    team_file = td / "team.json"
    if team_file.exists():
        data = load_json(team_file)
        if data.get("status") == "active":
            print(f"Team '{name}' already exists and is active.")
            print(f"  Use: team_session.py status --name {name}")
            return 1

    agents = [a.strip() for a in args.agents.split(",")] if args.agents else DEFAULT_AGENTS
    lead = args.lead or DEFAULT_LEAD
    if lead not in agents:
        agents.append(lead)

    team = {
        "name": name,
        "status": "active",
        "created_at": now_iso(),
        "telegram_group_id": args.group_id or "",
        "repo_path": args.repo or "",
        "agents": agents,
        "lead": lead,
        "topic_map": {},
    }

    save_json(team_file, team)
    save_json(td / "tasks.json", {"tasks": []})
    save_json(td / "messages.json", {"messages": []})

    print(f"✓ Team '{name}' created")
    print(f"  Agents: {', '.join(agents)}")
    print(f"  Lead: {lead}")
    if team["telegram_group_id"]:
        print(f"  Telegram group: {team['telegram_group_id']}")
    if team["repo_path"]:
        print(f"  Repo: {team['repo_path']}")
    print(f"  Workspace: {td}")
    return 0


def cmd_list(_args) -> int:
    """List all teams."""
    if not TEAMS_DIR.exists():
        print("No teams found.")
        return 0

    teams = []
    for d in sorted(TEAMS_DIR.iterdir()):
        team_file = d / "team.json"
        if team_file.exists():
            data = load_json(team_file)
            teams.append(data)

    if not teams:
        print("No teams found.")
        return 0

    print(f"{'Name':<20} {'Status':<10} {'Agents':<30} {'Group':<16} {'Created'}")
    print("-" * 90)
    for t in teams:
        agents = ", ".join(t.get("agents", []))
        group = t.get("telegram_group_id", "")[:15] or "-"
        created = t.get("created_at", "?")[:10]
        print(f"{t['name']:<20} {t.get('status', '?'):<10} {agents:<30} {group:<16} {created}")
    return 0


def cmd_status(args) -> int:
    """Show team status with task board."""
    name = args.name
    td = team_dir(name)
    team_file = td / "team.json"

    if not team_file.exists():
        print(f"Team '{name}' not found.")
        return 1

    team = load_json(team_file)
    tasks_data = load_json(td / "tasks.json")
    messages_data = load_json(td / "messages.json")
    tasks = tasks_data.get("tasks", [])
    messages = messages_data.get("messages", [])

    if getattr(args, "json", False):
        print(json.dumps({
            "team": team,
            "tasks": tasks,
            "recent_messages": messages[-10:],
        }, indent=2, default=str))
        return 0

    # Team info
    print("=" * 60)
    print(f" TEAM: {team['name'].upper()}")
    print("=" * 60)
    print(f"  Status:   {team.get('status', '?')}")
    print(f"  Lead:     {team.get('lead', '?')}")
    print(f"  Agents:   {', '.join(team.get('agents', []))}")
    if team.get("telegram_group_id"):
        print(f"  Group:    {team['telegram_group_id']}")
    if team.get("repo_path"):
        print(f"  Repo:     {team['repo_path']}")
    print(f"  Created:  {team.get('created_at', '?')[:19]}")

    # Task board
    todo = [t for t in tasks if t.get("status") == "todo"]
    doing = [t for t in tasks if t.get("status") == "in_progress"]
    done = [t for t in tasks if t.get("status") == "done"]
    blocked = [t for t in tasks if t.get("status") == "blocked"]

    print(f"\n  📋 Task Board ({len(tasks)} total: {len(done)} done, {len(doing)} in progress, {len(todo)} todo, {len(blocked)} blocked)")
    if tasks:
        status_icon = {"todo": "📋", "in_progress": "🔄", "done": "✅", "blocked": "🚫", "cancelled": "❌"}
        for t in tasks:
            icon = status_icon.get(t["status"], "?")
            agent = t.get("assigned_to", "unassigned")
            print(f"    {icon} {t['id']} [{agent:<12}] {t['title']}")
            if t.get("notes"):
                print(f"       Note: {t['notes']}")
    else:
        print("    (no tasks)")

    # Recent messages
    recent = messages[-5:]
    if recent:
        print(f"\n  💬 Recent Messages ({len(messages)} total)")
        for m in recent:
            print(f"    [{m.get('from', '?')} → {m.get('to', '?')}] {m.get('body', '')[:60]}")
    else:
        print(f"\n  💬 No messages")

    print("\n" + "=" * 60)
    return 0


def cmd_close(args) -> int:
    """Close a team session."""
    name = args.name
    td = team_dir(name)
    team_file = td / "team.json"

    if not team_file.exists():
        print(f"Team '{name}' not found.")
        return 1

    team = load_json(team_file)
    team["status"] = "closed"
    team["closed_at"] = now_iso()
    save_json(team_file, team)

    tasks_data = load_json(td / "tasks.json")
    tasks = tasks_data.get("tasks", [])
    done_count = len([t for t in tasks if t.get("status") == "done"])

    print(f"✓ Team '{name}' closed")
    print(f"  Tasks completed: {done_count}/{len(tasks)}")
    return 0


# -------------------------------------------------------------------
# Task Management
# -------------------------------------------------------------------

def cmd_task_add(args) -> int:
    """Add a task to the team's task board."""
    name = args.name
    td = team_dir(name)
    tasks_file = td / "tasks.json"

    if not (td / "team.json").exists():
        print(f"Team '{name}' not found.")
        return 1

    data = load_json(tasks_file)
    tasks = data.setdefault("tasks", [])

    depends_on = [d.strip() for d in args.depends_on.split(",")] if args.depends_on else []

    task = {
        "id": gen_task_id(tasks),
        "title": args.title,
        "assigned_to": args.assign_to or "unassigned",
        "status": "todo",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "depends_on": depends_on,
        "notes": "",
    }

    tasks.append(task)
    save_json(tasks_file, data)

    print(json.dumps(task, indent=2, default=str))
    return 0


def cmd_task_claim(args) -> int:
    """Claim (assign) a task to an agent."""
    name = args.name
    td = team_dir(name)
    tasks_file = td / "tasks.json"

    data = load_json(tasks_file)
    tasks = data.get("tasks", [])

    for task in tasks:
        if task["id"] == args.task_id:
            task["assigned_to"] = args.agent
            if task["status"] == "todo":
                task["status"] = "in_progress"
            task["updated_at"] = now_iso()
            save_json(tasks_file, data)
            print(json.dumps(task, indent=2, default=str))
            return 0

    print(json.dumps({"error": f"Task {args.task_id} not found"}, indent=2))
    return 1


def cmd_task_update(args) -> int:
    """Update a task's status and/or notes."""
    name = args.name
    td = team_dir(name)
    tasks_file = td / "tasks.json"

    data = load_json(tasks_file)
    tasks = data.get("tasks", [])

    for task in tasks:
        if task["id"] == args.task_id:
            if args.status:
                if args.status not in TASK_STATUSES:
                    print(json.dumps({"error": f"Invalid status '{args.status}'. Valid: {TASK_STATUSES}"}))
                    return 1
                task["status"] = args.status
            if args.notes:
                task["notes"] = args.notes
            task["updated_at"] = now_iso()
            save_json(tasks_file, data)
            print(json.dumps(task, indent=2, default=str))
            return 0

    print(json.dumps({"error": f"Task {args.task_id} not found"}, indent=2))
    return 1


def cmd_task_list(args) -> int:
    """List all tasks for a team."""
    name = args.name
    td = team_dir(name)
    tasks_file = td / "tasks.json"

    if not (td / "team.json").exists():
        print(json.dumps({"error": f"Team '{name}' not found"}))
        return 1

    data = load_json(tasks_file)
    tasks = data.get("tasks", [])

    if getattr(args, "json", False):
        print(json.dumps({"tasks": tasks}, indent=2, default=str))
        return 0

    if not tasks:
        print("No tasks.")
        return 0

    status_icon = {"todo": "📋", "in_progress": "🔄", "done": "✅", "blocked": "🚫", "cancelled": "❌"}
    for t in tasks:
        icon = status_icon.get(t["status"], "?")
        agent = t.get("assigned_to", "unassigned")
        print(f"  {icon} {t['id']} [{agent:<12}] {t['title']}")
        if t.get("notes"):
            print(f"     Note: {t['notes']}")
        if t.get("depends_on"):
            print(f"     Deps: {', '.join(t['depends_on'])}")
    return 0


# -------------------------------------------------------------------
# Inter-Agent Messaging
# -------------------------------------------------------------------

def cmd_message(args) -> int:
    """Send a message between agents."""
    name = args.name
    td = team_dir(name)
    messages_file = td / "messages.json"

    if not (td / "team.json").exists():
        print(json.dumps({"error": f"Team '{name}' not found"}))
        return 1

    data = load_json(messages_file)
    messages = data.setdefault("messages", [])

    msg = {
        "id": gen_msg_id(),
        "from": getattr(args, "from_agent", args.__dict__.get("from", "unknown")),
        "to": args.to,
        "body": args.body,
        "timestamp": now_iso(),
        "read": False,
    }

    messages.append(msg)
    save_json(messages_file, data)
    print(json.dumps(msg, indent=2, default=str))
    return 0


def cmd_messages(args) -> int:
    """List messages for a team."""
    name = args.name
    td = team_dir(name)
    messages_file = td / "messages.json"

    if not (td / "team.json").exists():
        print(json.dumps({"error": f"Team '{name}' not found"}))
        return 1

    data = load_json(messages_file)
    messages = data.get("messages", [])

    if getattr(args, "json", False):
        print(json.dumps({"messages": messages}, indent=2, default=str))
        return 0

    if not messages:
        print("No messages.")
        return 0

    for m in messages:
        ts = m.get("timestamp", "")[:19]
        read_mark = "" if m.get("read") else " (new)"
        print(f"  [{ts}] {m['from']} → {m['to']}{read_mark}: {m['body']}")
    return 0


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(
        description="Team Session Manager — multi-agent collaboration for Claw Core.",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    # create
    p = sub.add_parser("create", help="Create a new team session")
    p.add_argument("--name", "-n", required=True, help="Team name (used as directory name)")
    p.add_argument("--group-id", "-g", default="", help="Telegram group ID")
    p.add_argument("--repo", "-r", default="", help="Path to shared project repo")
    p.add_argument("--agents", "-a", default="", help="Comma-separated agent IDs (default: artist,assistant,developer)")
    p.add_argument("--lead", "-l", default="", help="Lead agent ID (default: developer)")

    # list
    sub.add_parser("list", help="List all teams")

    # status
    p = sub.add_parser("status", help="Show team status with task board")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--json", action="store_true", help="Output as JSON")

    # close
    p = sub.add_parser("close", help="Close a team session")
    p.add_argument("--name", "-n", required=True, help="Team name")

    # task-add
    p = sub.add_parser("task-add", help="Add a task to the team's task board")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--title", "-t", required=True, help="Task title")
    p.add_argument("--assign-to", default="", help="Agent to assign (or 'unassigned')")
    p.add_argument("--depends-on", default="", help="Comma-separated task IDs this depends on")

    # task-claim
    p = sub.add_parser("task-claim", help="Claim a task for an agent")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--task-id", required=True, help="Task ID (e.g., T001)")
    p.add_argument("--agent", required=True, help="Agent claiming the task")

    # task-update
    p = sub.add_parser("task-update", help="Update a task's status or notes")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--task-id", required=True, help="Task ID")
    p.add_argument("--status", "-s", default="", help=f"New status: {TASK_STATUSES}")
    p.add_argument("--notes", default="", help="Notes to add")

    # task-list
    p = sub.add_parser("task-list", help="List all tasks")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--json", action="store_true", help="Output as JSON")

    # message
    p = sub.add_parser("message", help="Send a message between agents")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--from", dest="from_agent", required=True, help="Sender agent ID")
    p.add_argument("--to", required=True, help="Recipient agent ID")
    p.add_argument("--body", "-b", required=True, help="Message body")

    # messages
    p = sub.add_parser("messages", help="List inter-agent messages")
    p.add_argument("--name", "-n", required=True, help="Team name")
    p.add_argument("--json", action="store_true", help="Output as JSON")

    args = ap.parse_args()

    commands = {
        "create": cmd_create,
        "list": cmd_list,
        "status": cmd_status,
        "close": cmd_close,
        "task-add": cmd_task_add,
        "task-claim": cmd_task_claim,
        "task-update": cmd_task_update,
        "task-list": cmd_task_list,
        "message": cmd_message,
        "messages": cmd_messages,
    }

    handler = commands.get(args.cmd)
    if handler:
        return handler(args)

    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
