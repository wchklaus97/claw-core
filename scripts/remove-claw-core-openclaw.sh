#!/usr/bin/env bash
# Remove claw-core from OpenClaw: stop daemon, remove plugin, skills, and config entries.
# Symmetrical with install-claw-core-openclaw.sh — removes what install creates.
#
# Usage:
#   ./scripts/remove-claw-core-openclaw.sh          # Remove plugin, skills, clean config
#   ./scripts/remove-claw-core-openclaw.sh --help   # Show usage
#
# Environment:
#   CLAW_ROOT           — claw repo path (default: parent of scripts/)
#   OPENCLAW_PLUGIN_DIR — plugin install dir (default: ~/.openclaw/extensions/claw-core)
#   OPENCLAW_SKILLS_DIR — skills dir (default: ~/.openclaw/skills)
#   CLAW_CORE_SOCKET    — daemon socket path (default: /tmp/trl.sock)

set -euo pipefail

CLAW_ROOT="${CLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PLUGIN_DIR="${OPENCLAW_PLUGIN_DIR:-$HOME/.openclaw/extensions/claw-core}"
SKILLS_DIR="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
SKILLS_LIST="$CLAW_ROOT/scripts/claw-core-skills.list"
SOCKET_PATH="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"
PID_FILE="${CLAW_CORE_PID_FILE:-/tmp/claw_core.pid}"

# ── Parse arguments ──────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Removes the claw-core plugin, its skills, and cleans openclaw.json."
  echo ""
  echo "Options:"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Environment:"
  echo "  CLAW_ROOT           Claw repo path (default: auto-detect)"
  echo "  OPENCLAW_PLUGIN_DIR Plugin install dir (default: ~/.openclaw/extensions/claw-core)"
  echo "  OPENCLAW_SKILLS_DIR Skills dir (default: ~/.openclaw/skills)"
  echo "  CLAW_CORE_SOCKET    Daemon socket path (default: /tmp/trl.sock)"
  echo "  CLAW_CORE_PID_FILE  Daemon PID file (default: /tmp/claw_core.pid)"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage ;;
    *)
      echo "✗ Unknown argument: $arg"
      echo "  Run with --help for usage."
      exit 1
      ;;
  esac
done

# ── Load skill list ──────────────────────────────────────────────────────────

CLAW_SKILLS=()
if [ -f "$SKILLS_LIST" ]; then
  while IFS= read -r line; do
    line="${line%%#*}"   # strip comments
    line="${line// /}"   # strip whitespace
    [ -n "$line" ] && CLAW_SKILLS+=("$line")
  done < "$SKILLS_LIST"
else
  echo "⚠ Skills list not found: $SKILLS_LIST"
  echo "  Using built-in fallback list."
  CLAW_SKILLS=(claw-core-runtime claw-core-sessions claw-core-daemon cron-helper cursor-agent cursor-cron-bridge plans-mode status-dashboard)
fi

echo "Remove claw-core from OpenClaw"
echo "CLAW_ROOT=$CLAW_ROOT"
echo "PLUGIN_DIR=$PLUGIN_DIR"
echo "SKILLS_DIR=$SKILLS_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ── 1. Stop daemon ───────────────────────────────────────────────────────────

echo "1. Stopping claw_core daemon..."
if command -v openclaw >/dev/null 2>&1; then
  openclaw clawcore stop 2>/dev/null || true
elif [ -f "$CLAW_ROOT/scripts/claw_core_daemon.sh" ]; then
  "$CLAW_ROOT/scripts/claw_core_daemon.sh" stop 2>/dev/null || true
else
  # Fallback: kill by PID file and remove socket
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null) || true
    [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  rm -f "$SOCKET_PATH"
fi
echo "   ✓ Done."
echo

# ── 2. Remove plugin ────────────────────────────────────────────────────────

echo "2. Removing plugin..."
if [ -L "$PLUGIN_DIR" ]; then
  rm -f "$PLUGIN_DIR"
  echo "   ✓ Removed symlink: $PLUGIN_DIR"
elif [ -d "$PLUGIN_DIR" ]; then
  rm -rf "$PLUGIN_DIR"
  echo "   ✓ Removed: $PLUGIN_DIR"
else
  echo "   ○ Not found (already removed)"
fi
echo

# ── 3. Remove skills ────────────────────────────────────────────────────────

echo "3. Removing claw-core skills..."
removed=0
for skill in "${CLAW_SKILLS[@]}"; do
  if [ -d "$SKILLS_DIR/$skill" ] || [ -L "$SKILLS_DIR/$skill" ]; then
    rm -rf "$SKILLS_DIR/$skill"
    echo "   ✓ Removed: $skill"
    ((removed++))
  fi
done
[ "$removed" -eq 0 ] && echo "   ○ No skills found to remove"
echo

# ── 4. Clean openclaw.json ───────────────────────────────────────────────────

echo "4. Cleaning openclaw.json..."
if [ ! -f "$OPENCLAW_CONFIG" ]; then
  echo "   ○ $OPENCLAW_CONFIG not found — nothing to clean."
else
  python3 - "$OPENCLAW_CONFIG" "$CLAW_ROOT" "${CLAW_SKILLS[@]}" <<'PYEOF'
import json, sys, os

config_path = sys.argv[1]
claw_root = sys.argv[2]
skill_names = sys.argv[3:]

with open(config_path, "r") as f:
    cfg = json.load(f)

changed = False

# --- Remove plugins.entries.claw-core ---
entries = cfg.get("plugins", {}).get("entries", {})
if "claw-core" in entries:
    del entries["claw-core"]
    changed = True
    print("   ✓ Removed plugins.entries.claw-core")

# --- Remove plugins.installs.claw-core ---
installs = cfg.get("plugins", {}).get("installs", {})
if "claw-core" in installs:
    del installs["claw-core"]
    changed = True
    print("   ✓ Removed plugins.installs.claw-core")

# --- Remove load.paths pointing to claw plugin ---
load_paths = cfg.get("plugins", {}).get("load", {}).get("paths", [])
claw_plugin_path = os.path.join(claw_root, "plugin")
cleaned_paths = [p for p in load_paths if os.path.normpath(p) != os.path.normpath(claw_plugin_path)]
if len(cleaned_paths) != len(load_paths):
    if cleaned_paths:
        cfg["plugins"]["load"]["paths"] = cleaned_paths
    else:
        cfg["plugins"]["load"].pop("paths", None)
        if not cfg["plugins"].get("load"):
            cfg["plugins"].pop("load", None)
    changed = True
    print("   ✓ Removed load path: " + claw_plugin_path)

# --- Remove skill entries ---
skill_entries = cfg.get("skills", {}).get("entries", {})
for name in skill_names:
    if name in skill_entries:
        del skill_entries[name]
        changed = True

# --- Remove Cursor integration (added by setup-cursor-integration.cjs) ---
agents = cfg.get("agents", {})
defaults = agents.get("defaults", {})
cli_backends = defaults.get("cliBackends")
if cli_backends is not None:
    for name in ["cursor-cli", "cursor-plan", "cursor-ask"]:
        if name in cli_backends:
            del cli_backends[name]
            changed = True
            print("   ✓ Removed agents.defaults.cliBackends." + name)
    if not cli_backends:
        del defaults["cliBackends"]
        changed = True

agent_list = agents.get("list") or []
new_list = [a for a in agent_list if a.get("id") != "cursor-dev"]
if len(new_list) != len(agent_list):
    cfg["agents"]["list"] = new_list
    changed = True
    print("   ✓ Removed cursor-dev agent")

if changed and skill_names:
    print("   ✓ Removed skill entries from config")

if changed:
    with open(config_path, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("   ✓ openclaw.json updated")
else:
    print("   ○ No claw-core entries found in config")
PYEOF
fi
echo

# ── Done ─────────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ claw-core removed."
