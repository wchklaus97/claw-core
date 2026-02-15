#!/usr/bin/env python3
"""
Multi-bot setup script for Claw Core OpenClaw plugin.

Creates 3 specialized Telegram bot agents (artist, assistant, developer),
configures OpenClaw with multi-account Telegram routing, and sets up
per-agent workspaces with personality templates.

Usage:
  setup_bots.py [options]
  setup_bots.py --image-token TOKEN --qa-token TOKEN --dev-token TOKEN
  setup_bots.py --link-repo artist /path/to/design-repo
  setup_bots.py --help

Creates:
  - 3 agent workspaces (~/.openclaw/workspace-{artist,assistant,developer}/)
  - SOUL.md, IDENTITY.md, AGENTS.md in each workspace (from templates)
  - Merges into ~/.openclaw/openclaw.json:
    - agents.list with 3 agents + per-agent tool profiles
    - channels.telegram.accounts with 3 bot tokens
    - bindings routing each account to its agent
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
PLUGIN_ROOT = Path(os.environ.get("CLAW_CORE_PLUGIN_ROOT", Path(__file__).resolve().parent.parent))
TEMPLATES_DIR = PLUGIN_ROOT / "templates"

# Agent definitions
AGENTS = {
    "artist": {
        "description": "Image generation & visual creation specialist",
        "workspace_suffix": "workspace-artist",
        "token_flag": "image_token",
        "account_id": "image-bot",
        "tools_profile": "minimal",
        "tools_allow": ["cursor_agent_direct", "image", "read", "write"],
    },
    "assistant": {
        "description": "Q&A & knowledge assistant via PicoClaw",
        "workspace_suffix": "workspace-assistant",
        "token_flag": "qa_token",
        "account_id": "qa-bot",
        "tools_profile": "messaging",
        "tools_allow": [
            "picoclaw_chat",
            "picoclaw_config",
            "web_search",
            "web_fetch",
            "read",
        ],
    },
    "developer": {
        "description": "Software development & DevOps specialist",
        "workspace_suffix": "workspace-developer",
        "token_flag": "dev_token",
        "account_id": "dev-bot",
        "tools_profile": "full",
        "tools_allow": [
            "cursor_agent_direct",
            "exec",
            "bash",
            "read",
            "write",
            "edit",
            "apply_patch",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "cron",
            "picoclaw_chat",
            "image",
        ],
    },
}


def load_openclaw_config() -> dict:
    """Load existing openclaw.json or create skeleton."""
    if OPENCLAW_CONFIG.exists():
        try:
            with open(OPENCLAW_CONFIG, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            print(f"⚠ Could not parse {OPENCLAW_CONFIG}, creating backup and starting fresh")
            backup = OPENCLAW_CONFIG.with_suffix(".json.bak")
            shutil.copy2(OPENCLAW_CONFIG, backup)
            return {}
    return {}


def save_openclaw_config(config: dict) -> None:
    """Save openclaw.json with pretty formatting."""
    OPENCLAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(OPENCLAW_CONFIG, "w") as f:
        json.dump(config, f, indent=2)
    print(f"  ✓ Saved {OPENCLAW_CONFIG}")


def setup_workspace(agent_id: str, agent_def: dict, repo_path: str | None = None) -> str:
    """Create agent workspace and copy template files."""
    workspace = OPENCLAW_DIR / agent_def["workspace_suffix"]
    workspace.mkdir(parents=True, exist_ok=True)

    template_dir = TEMPLATES_DIR / agent_id
    if template_dir.exists():
        for template_file in template_dir.iterdir():
            if template_file.is_file():
                dest = workspace / template_file.name
                if dest.exists():
                    print(f"  · {template_file.name} already exists in {agent_id} workspace (keeping)")
                else:
                    shutil.copy2(template_file, dest)
                    print(f"  ✓ Copied {template_file.name} to {agent_id} workspace")
    else:
        print(f"  ⚠ Template directory not found: {template_dir}")

    # Link repo if provided
    if repo_path:
        repo_link = workspace / "repo"
        repo_path_resolved = Path(repo_path).resolve()
        if not repo_path_resolved.exists():
            print(f"  ⚠ Repo path does not exist: {repo_path_resolved}")
        elif repo_link.exists() or repo_link.is_symlink():
            print(f"  · Repo link already exists in {agent_id} workspace (keeping)")
        else:
            repo_link.symlink_to(repo_path_resolved)
            print(f"  ✓ Linked repo: {repo_path_resolved} → {repo_link}")

    return str(workspace)


def merge_agents(config: dict, tokens: dict, repo_paths: dict) -> None:
    """Merge agent definitions into openclaw.json."""
    # Ensure agents.list exists
    agents_section = config.setdefault("agents", {})
    agents_list = agents_section.setdefault("list", [])

    # Index existing agents by id
    existing_ids = {a["id"]: i for i, a in enumerate(agents_list) if "id" in a}

    for agent_id, agent_def in AGENTS.items():
        workspace_path = setup_workspace(
            agent_id, agent_def, repo_paths.get(agent_id)
        )

        agent_entry = {
            "id": agent_id,
            "workspace": workspace_path,
            "tools": {
                "profile": agent_def["tools_profile"],
                "allow": agent_def["tools_allow"],
            },
        }

        if agent_id in existing_ids:
            # Merge: update workspace and tools, keep other fields
            idx = existing_ids[agent_id]
            for key, value in agent_entry.items():
                agents_list[idx][key] = value
            print(f"  ✓ Updated agent: {agent_id}")
        else:
            agents_list.append(agent_entry)
            print(f"  ✓ Added agent: {agent_id}")


def merge_telegram_accounts(config: dict, tokens: dict) -> None:
    """Merge Telegram bot accounts into openclaw.json."""
    channels = config.setdefault("channels", {})
    telegram = channels.setdefault("telegram", {})

    # Keep existing settings (dmPolicy, etc.)
    if "enabled" not in telegram:
        telegram["enabled"] = True

    accounts = telegram.setdefault("accounts", [])
    existing_account_ids = {a.get("id"): i for i, a in enumerate(accounts)}

    for agent_id, agent_def in AGENTS.items():
        account_id = agent_def["account_id"]
        token_flag = agent_def["token_flag"]
        token = tokens.get(token_flag, "")

        account_entry = {"id": account_id}
        if token:
            account_entry["botToken"] = token

        if account_id in existing_account_ids:
            idx = existing_account_ids[account_id]
            if token:
                accounts[idx]["botToken"] = token
            print(f"  ✓ Updated Telegram account: {account_id}" + (" (with token)" if token else " (token unchanged)"))
        else:
            if not token:
                account_entry["botToken"] = f"<{token_flag.upper().replace('_', '-')}-HERE>"
            accounts.append(account_entry)
            print(f"  ✓ Added Telegram account: {account_id}" + (" (with token)" if token else " (placeholder)"))


def merge_bindings(config: dict) -> None:
    """Merge routing bindings into openclaw.json."""
    bindings = config.setdefault("bindings", [])
    existing_bindings = set()
    for b in bindings:
        match = b.get("match", {})
        account = match.get("account", "")
        agent = b.get("agentId", "")
        if account and agent:
            existing_bindings.add((account, agent))

    for agent_id, agent_def in AGENTS.items():
        account_id = agent_def["account_id"]
        if (account_id, agent_id) not in existing_bindings:
            bindings.append({
                "match": {"channel": "telegram", "account": account_id},
                "agentId": agent_id,
            })
            print(f"  ✓ Added binding: {account_id} → {agent_id}")
        else:
            print(f"  · Binding already exists: {account_id} → {agent_id}")


def print_summary(tokens: dict) -> None:
    """Print setup summary with next steps."""
    print("\n" + "=" * 60)
    print(" SETUP COMPLETE")
    print("=" * 60)

    print("\n📦 Three bot agents configured:")
    for agent_id, agent_def in AGENTS.items():
        token_flag = agent_def["token_flag"]
        has_token = bool(tokens.get(token_flag))
        status = "✓ token set" if has_token else "⚠ needs token"
        workspace = OPENCLAW_DIR / agent_def["workspace_suffix"]
        print(f"  🤖 {agent_id:<12} [{status}]")
        print(f"     {agent_def['description']}")
        print(f"     Workspace: {workspace}")

    missing_tokens = [
        agent_def["token_flag"]
        for agent_def in AGENTS.values()
        if not tokens.get(agent_def["token_flag"])
    ]

    print("\n📋 Next steps:")
    if missing_tokens:
        print("  1. Create Telegram bots via @BotFather (https://t.me/BotFather)")
        print("     Create 3 bots and get their tokens:")
        print("       - Image bot (e.g., @YourArtistBot)")
        print("       - Q&A bot (e.g., @YourAssistantBot)")
        print("       - Dev bot (e.g., @YourDevBot)")
        print(f"\n  2. Re-run with tokens:")
        print(f"     openclaw clawcore setup-bots \\")
        print(f"       --image-token YOUR_IMAGE_BOT_TOKEN \\")
        print(f"       --qa-token YOUR_QA_BOT_TOKEN \\")
        print(f"       --dev-token YOUR_DEV_BOT_TOKEN")
        print(f"\n  Or manually edit: {OPENCLAW_CONFIG}")
        print(f"  Set botToken in channels.telegram.accounts for each bot.")
    else:
        print("  1. All tokens are set! Restart the gateway:")
        print("     openclaw gateway restart")
        print("\n  2. Start chatting with your bots in Telegram!")

    print(f"\n  Config: {OPENCLAW_CONFIG}")
    print(f"  Workspaces: {OPENCLAW_DIR}/workspace-{{artist,assistant,developer}}/")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Set up 3 specialized Telegram bot agents for OpenClaw (artist, assistant, developer).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Setup with all tokens:
  %(prog)s --image-token 123:AAA --qa-token 456:BBB --dev-token 789:CCC

  # Setup with tokens and link repos:
  %(prog)s --image-token 123:AAA --qa-token 456:BBB --dev-token 789:CCC \\
    --dev-repo /path/to/my-project --image-repo /path/to/design-assets

  # Setup without tokens (creates placeholders, configure later):
  %(prog)s

  # Link a repo to an agent workspace:
  %(prog)s --link-repo developer /path/to/my-project
""",
    )
    ap.add_argument("--image-token", default="", help="Telegram bot token for the image/artist bot")
    ap.add_argument("--qa-token", default="", help="Telegram bot token for the Q&A/assistant bot")
    ap.add_argument("--dev-token", default="", help="Telegram bot token for the developer bot")
    ap.add_argument("--image-repo", default="", help="Path to repo for the artist workspace")
    ap.add_argument("--qa-repo", default="", help="Path to repo for the assistant workspace")
    ap.add_argument("--dev-repo", default="", help="Path to repo for the developer workspace")
    ap.add_argument(
        "--link-repo",
        nargs=2,
        metavar=("AGENT", "PATH"),
        action="append",
        default=[],
        help="Link a repo to an agent workspace (e.g., --link-repo developer /path/to/project)",
    )
    ap.add_argument("--team-group", default="", help="Telegram group ID for team collaboration (configures broadcast group)")
    ap.add_argument("--team-name", default="", help="Team name for team session (default: auto-generated)")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    args = ap.parse_args()

    tokens = {
        "image_token": args.image_token,
        "qa_token": args.qa_token,
        "dev_token": args.dev_token,
    }

    repo_paths: dict[str, str] = {}
    if args.image_repo:
        repo_paths["artist"] = args.image_repo
    if args.qa_repo:
        repo_paths["assistant"] = args.qa_repo
    if args.dev_repo:
        repo_paths["developer"] = args.dev_repo
    for agent_name, path in args.link_repo:
        if agent_name in AGENTS:
            repo_paths[agent_name] = path
        else:
            print(f"⚠ Unknown agent '{agent_name}'. Valid agents: {', '.join(AGENTS.keys())}")

    if args.dry_run:
        print("DRY RUN — no changes will be made\n")

    print("=" * 60)
    print(" CLAW CORE — Multi-Bot Setup")
    print("=" * 60)

    # Load existing config
    print(f"\n📂 Config: {OPENCLAW_CONFIG}")
    config = load_openclaw_config()

    if args.dry_run:
        print("\n[dry-run] Would create/update:")
        for agent_id, agent_def in AGENTS.items():
            workspace = OPENCLAW_DIR / agent_def["workspace_suffix"]
            print(f"  Workspace: {workspace}")
            print(f"  Agent: {agent_id} ({agent_def['description']})")
        print(f"\n[dry-run] Would update: {OPENCLAW_CONFIG}")
        return 0

    # Step 1: Create workspaces and merge agents
    print("\n🔧 Setting up agent workspaces...")
    merge_agents(config, tokens, repo_paths)

    # Step 2: Merge Telegram accounts
    print("\n📱 Configuring Telegram accounts...")
    merge_telegram_accounts(config, tokens)

    # Step 3: Merge bindings
    print("\n🔗 Setting up routing bindings...")
    merge_bindings(config)

    # Step 4: Save config
    print("\n💾 Saving configuration...")
    save_openclaw_config(config)

    # Step 5: Install skills
    install_skills_sh = PLUGIN_ROOT / "scripts" / "install-skills-to-openclaw.sh"
    if install_skills_sh.exists():
        print("\n📚 Installing skills...")
        os.system(f"bash '{install_skills_sh}'")
    else:
        print(f"\n⚠ Skills installer not found: {install_skills_sh}")

    # Step 6: Team setup (if --team-group provided)
    if args.team_group:
        print("\n🤝 Setting up agent team...")
        team_session_py = PLUGIN_ROOT / "scripts" / "team_session.py"
        team_setup_py = PLUGIN_ROOT / "scripts" / "team_setup_telegram.py"
        team_name = args.team_name or "default-team"

        # Find a shared repo from any of the provided repos
        shared_repo = args.dev_repo or args.image_repo or args.qa_repo or ""

        if team_session_py.exists():
            # Create team session
            team_cmd = f"python3 '{team_session_py}' create --name '{team_name}' --group-id '{args.team_group}'"
            if shared_repo:
                team_cmd += f" --repo '{shared_repo}'"
            os.system(team_cmd)

            # Configure Telegram group
            if team_setup_py.exists():
                tg_cmd = f"python3 '{team_setup_py}' --name '{team_name}' --group-id '{args.team_group}'"
                os.system(tg_cmd)
        else:
            print(f"  ⚠ team_session.py not found: {team_session_py}")

    # Summary
    print_summary(tokens)
    return 0


if __name__ == "__main__":
    sys.exit(main())
