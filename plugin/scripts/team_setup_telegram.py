#!/usr/bin/env python3
"""
Configure OpenClaw for team Telegram group chat.

Updates ~/.openclaw/openclaw.json with:
- Broadcast group (all agents listen in parallel)
- Per-topic bindings (optional, for forum topics)
- Group settings (requireMention, systemPrompt)

Also updates the team's team.json with topic mappings.

Usage:
  team_setup_telegram.py --name NAME --group-id ID [options]

  team_setup_telegram.py --name "project-alpha" --group-id -100123456
  team_setup_telegram.py --name "project-alpha" --group-id -100123456 \\
    --topic-design 42 --topic-research 43 --topic-code 44
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

OPENCLAW_DIR = Path.home() / ".openclaw"
OPENCLAW_CONFIG = OPENCLAW_DIR / "openclaw.json"
TEAMS_DIR = Path(os.environ.get("OPENCLAW_TEAMS_DIR", OPENCLAW_DIR / "teams"))


def load_config() -> dict:
    """Load openclaw.json or create empty structure."""
    if OPENCLAW_CONFIG.exists():
        try:
            with open(OPENCLAW_CONFIG, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            backup = OPENCLAW_CONFIG.with_suffix(".json.bak")
            shutil.copy2(OPENCLAW_CONFIG, backup)
            print(f"⚠ Backed up corrupt config to {backup}")
            return {}
    return {}


def save_config(config: dict) -> None:
    """Save openclaw.json."""
    OPENCLAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(OPENCLAW_CONFIG, "w") as f:
        json.dump(config, f, indent=2)
    print(f"  ✓ Saved {OPENCLAW_CONFIG}")


def load_team(name: str) -> dict | None:
    """Load a team definition."""
    team_file = TEAMS_DIR / name / "team.json"
    if not team_file.exists():
        return None
    with open(team_file, "r") as f:
        return json.load(f)


def save_team(name: str, team: dict) -> None:
    """Save a team definition."""
    team_file = TEAMS_DIR / name / "team.json"
    team_file.parent.mkdir(parents=True, exist_ok=True)
    with open(team_file, "w") as f:
        json.dump(team, f, indent=2)


def setup_broadcast(config: dict, group_id: str, agents: list[str]) -> None:
    """Configure broadcast group so all agents listen in parallel."""
    broadcast = config.setdefault("broadcast", {})

    if "strategy" not in broadcast:
        broadcast["strategy"] = "parallel"

    existing = broadcast.get(group_id, [])
    merged = list(dict.fromkeys(existing + agents))  # preserve order, deduplicate
    broadcast[group_id] = merged
    print(f"  ✓ Broadcast group {group_id}: {merged}")


def setup_group_settings(config: dict, group_id: str, system_prompt: str = "") -> None:
    """Configure Telegram group settings."""
    channels = config.setdefault("channels", {})
    telegram = channels.setdefault("telegram", {})
    groups = telegram.setdefault("groups", {})

    group_config = groups.setdefault(group_id, {})
    group_config["requireMention"] = True

    if system_prompt:
        group_config["systemPrompt"] = system_prompt

    print(f"  ✓ Group {group_id}: requireMention=true")


def setup_topic_bindings(config: dict, group_id: str, topic_map: dict[str, int]) -> None:
    """Create bindings to route forum topics to specific agents."""
    bindings = config.setdefault("bindings", [])

    # Map topic names to agent IDs
    topic_agent_map = {
        "design": "artist",
        "research": "assistant",
        "code": "developer",
    }

    existing_topic_bindings = set()
    for b in bindings:
        match = b.get("match", {})
        peer = match.get("peer", {})
        if peer.get("id") == group_id and peer.get("topicId"):
            existing_topic_bindings.add(str(peer["topicId"]))

    for topic_name, topic_id in topic_map.items():
        if not topic_id or topic_id <= 0:
            continue
        agent_id = topic_agent_map.get(topic_name)
        if not agent_id:
            continue
        if str(topic_id) in existing_topic_bindings:
            print(f"  · Topic {topic_name} ({topic_id}) binding already exists")
            continue

        bindings.append({
            "match": {
                "channel": "telegram",
                "peer": {
                    "kind": "group",
                    "id": group_id,
                    "topicId": topic_id,
                },
            },
            "agentId": agent_id,
        })
        print(f"  ✓ Topic {topic_name} ({topic_id}) → {agent_id}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Configure OpenClaw for team Telegram group chat.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic group setup (all agents in broadcast mode):
  %(prog)s --name "project-alpha" --group-id -100123456

  # With forum topic routing:
  %(prog)s --name "project-alpha" --group-id -100123456 \\
    --topic-design 42 --topic-research 43 --topic-code 44
""",
    )
    ap.add_argument("--name", "-n", required=True, help="Team name")
    ap.add_argument("--group-id", "-g", required=True, help="Telegram group ID")
    ap.add_argument("--topic-design", type=int, default=0, help="Forum topic ID for design (→ artist)")
    ap.add_argument("--topic-research", type=int, default=0, help="Forum topic ID for research (→ assistant)")
    ap.add_argument("--topic-code", type=int, default=0, help="Forum topic ID for code (→ developer)")
    ap.add_argument("--topic-general", type=int, default=0, help="Forum topic ID for general (broadcast)")
    ap.add_argument("--dry-run", action="store_true", help="Show what would change without saving")
    args = ap.parse_args()

    group_id = args.group_id

    # Load team
    team = load_team(args.name)
    if not team:
        print(f"⚠ Team '{args.name}' not found. Create it first:")
        print(f"  team_session.py create --name {args.name} --group-id {group_id}")
        return 1

    agents = team.get("agents", ["artist", "assistant", "developer"])

    print("=" * 60)
    print(f" TEAM TELEGRAM SETUP: {args.name}")
    print("=" * 60)

    if args.dry_run:
        print("\n[dry-run] Would configure:")
        print(f"  Broadcast group {group_id}: {agents}")
        print(f"  Group requireMention: true")
        if args.topic_design:
            print(f"  Topic design ({args.topic_design}) → artist")
        if args.topic_research:
            print(f"  Topic research ({args.topic_research}) → assistant")
        if args.topic_code:
            print(f"  Topic code ({args.topic_code}) → developer")
        return 0

    config = load_config()

    # 1. Broadcast group
    print("\n📡 Setting up broadcast group...")
    setup_broadcast(config, group_id, agents)

    # 2. Group settings
    print("\n⚙️ Configuring group settings...")
    system_prompt = (
        f"You are part of team '{args.name}'. "
        f"Use the team_coordinate tool for task management and inter-agent messaging. "
        f"Team lead: {team.get('lead', 'developer')}. "
        f"Agents: {', '.join(agents)}."
    )
    setup_group_settings(config, group_id, system_prompt)

    # 3. Topic bindings (if forum topics provided)
    topic_map = {}
    if args.topic_design:
        topic_map["design"] = args.topic_design
    if args.topic_research:
        topic_map["research"] = args.topic_research
    if args.topic_code:
        topic_map["code"] = args.topic_code

    if topic_map:
        print("\n📌 Setting up forum topic bindings...")
        setup_topic_bindings(config, group_id, topic_map)

    # 4. Save config
    print("\n💾 Saving configuration...")
    save_config(config)

    # 5. Update team.json
    team["telegram_group_id"] = group_id
    if topic_map or args.topic_general:
        full_topic_map = dict(topic_map)
        if args.topic_general:
            full_topic_map["general"] = args.topic_general
        team["topic_map"] = full_topic_map
    save_team(args.name, team)
    print(f"  ✓ Updated team.json")

    print(f"\n✅ Team '{args.name}' Telegram setup complete!")
    print(f"  Restart the gateway: openclaw gateway restart")
    print(f"  Then add all bots to the Telegram group and make them admins.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
