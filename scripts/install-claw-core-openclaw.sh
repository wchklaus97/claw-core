#!/usr/bin/env bash
# Install claw-core into OpenClaw: build binary, install plugin (and skills via postinstall).
# Symmetrical with remove-claw-core-openclaw.sh — installs what remove removes.
#
# Usage:
#   ./scripts/install-claw-core-openclaw.sh           # Copy install
#   ./scripts/install-claw-core-openclaw.sh -l         # Link install (dev)
#   ./scripts/install-claw-core-openclaw.sh --force    # Remove existing first, then install
#   ./scripts/install-claw-core-openclaw.sh --help     # Show usage
#
# Environment:
#   CLAW_ROOT           — claw repo path (default: parent of scripts/)
#   OPENCLAW_PLUGIN_DIR — plugin install dir (default: ~/.openclaw/extensions/claw-core)
#   CLAW_CORE_SOCKET    — daemon socket path (default: /tmp/trl.sock)

set -euo pipefail

CLAW_ROOT="${CLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PLUGIN_DIR="${OPENCLAW_PLUGIN_DIR:-$HOME/.openclaw/extensions/claw-core}"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
SKILLS_LIST="$CLAW_ROOT/scripts/claw-core-skills.list"

# ── Parse arguments ──────────────────────────────────────────────────────────

LINK_MODE=false
FORCE=false

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -l, --link     Link install (dev mode — edits apply immediately)"
  echo "  -f, --force    Remove existing plugin before installing (reinstall)"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Environment:"
  echo "  CLAW_ROOT           Claw repo path (default: auto-detect)"
  echo "  OPENCLAW_PLUGIN_DIR Plugin install dir (default: ~/.openclaw/extensions/claw-core)"
  echo "  CLAW_CORE_SOCKET    Daemon socket path (default: /tmp/trl.sock)"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    -l|--link)  LINK_MODE=true ;;
    -f|--force) FORCE=true ;;
    -h|--help)  usage ;;
    *)
      echo "✗ Unknown argument: $arg"
      echo "  Run with --help for usage."
      exit 1
      ;;
  esac
done

echo "Install claw-core into OpenClaw"
echo "CLAW_ROOT=$CLAW_ROOT"
echo "PLUGIN_DIR=$PLUGIN_DIR"
echo "Mode: $([ "$LINK_MODE" = true ] && echo 'link (dev)' || echo 'copy')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ── 1. Build release binary ─────────────────────────────────────────────────

echo "1. Building release binary..."
cargo build --release --manifest-path "$CLAW_ROOT/Cargo.toml"
BINARY="$CLAW_ROOT/target/release/claw_core"
if [ ! -f "$BINARY" ]; then
  echo "✗ Binary not found after build: $BINARY"
  exit 1
fi
echo "   ✓ Binary: $BINARY"
echo

# ── 2. Check OpenClaw ────────────────────────────────────────────────────────

if ! command -v openclaw >/dev/null 2>&1; then
  echo "✗ openclaw not on PATH. Install OpenClaw first."
  exit 1
fi
echo "2. ✓ OpenClaw CLI found"
echo

# ── 3. Handle existing plugin (--force or error) ────────────────────────────

# Helper: remove claw-core entries from openclaw.json so openclaw doesn't
# complain about a referenced-but-missing plugin during install.
clean_config_entries() {
  if [ -f "$OPENCLAW_CONFIG" ] && command -v python3 >/dev/null 2>&1; then
    python3 - "$OPENCLAW_CONFIG" "$CLAW_ROOT" <<'PYEOF'
import json, sys, os
config_path = sys.argv[1]
claw_root = sys.argv[2]
with open(config_path, "r") as f:
    cfg = json.load(f)
changed = False
for section in ["entries", "installs"]:
    store = cfg.get("plugins", {}).get(section, {})
    if "claw-core" in store:
        del store["claw-core"]
        changed = True
# Also remove load.paths pointing to claw plugin
load_paths = cfg.get("plugins", {}).get("load", {}).get("paths", [])
claw_plugin_path = os.path.join(claw_root, "plugin")
cleaned = [p for p in load_paths if os.path.normpath(p) != os.path.normpath(claw_plugin_path)]
if len(cleaned) != len(load_paths):
    if cleaned:
        cfg["plugins"]["load"]["paths"] = cleaned
    else:
        cfg["plugins"]["load"].pop("paths", None)
        if not cfg["plugins"].get("load"):
            cfg["plugins"].pop("load", None)
    changed = True
# Also remove skill entries so they don't reference a missing plugin
skills_list = os.path.join(claw_root, "scripts", "claw-core-skills.list")
if os.path.isfile(skills_list):
    with open(skills_list) as sf:
        for line in sf:
            name = line.strip()
            if not name or name.startswith("#"):
                continue
            se = cfg.get("skills", {}).get("entries", {})
            if name in se:
                del se[name]
                changed = True
# Remove Cursor integration (added by setup-cursor-integration.js)
agents = cfg.get("agents", {})
defaults = agents.get("defaults", {})
cli_backends = defaults.get("cliBackends")
if cli_backends is not None:
    for name in ["cursor-cli", "cursor-plan", "cursor-ask"]:
        if name in cli_backends:
            del cli_backends[name]
            changed = True
    if not cli_backends:
        del defaults["cliBackends"]
        changed = True
agent_list = agents.get("list") or []
new_list = [a for a in agent_list if a.get("id") != "cursor-dev"]
if len(new_list) != len(agent_list):
    cfg["agents"]["list"] = new_list
    changed = True
if changed:
    with open(config_path, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("   ✓ Cleaned stale config entries")
PYEOF
  fi
}

if [ "$FORCE" = true ]; then
  echo "3. Cleaning up for reinstall (--force)..."
  # Stop daemon first
  openclaw clawcore stop 2>/dev/null || true
  # Remove plugin dir if it exists
  if [ -d "$PLUGIN_DIR" ] || [ -L "$PLUGIN_DIR" ]; then
    rm -rf "$PLUGIN_DIR"
    echo "   ✓ Removed: $PLUGIN_DIR"
  fi
  # Always clean config entries in force mode to avoid stale references
  clean_config_entries
elif [ -d "$PLUGIN_DIR" ] || [ -L "$PLUGIN_DIR" ]; then
  echo "✗ Plugin already exists: $PLUGIN_DIR"
  echo "  Use --force to reinstall, or run remove first:"
  echo "    ./scripts/remove-claw-core-openclaw.sh"
  exit 1
else
  echo "3. No existing plugin (clean install)"
fi
echo

# ── 4. Install plugin ───────────────────────────────────────────────────────

echo "4. Installing plugin..."
if [ "$LINK_MODE" = true ]; then
  openclaw plugins install -l "$CLAW_ROOT/plugin"
else
  openclaw plugins install "$CLAW_ROOT/plugin"
fi

# Verify install succeeded
if [ ! -d "$PLUGIN_DIR" ] && [ "$LINK_MODE" = false ]; then
  echo "✗ Plugin directory not found after install: $PLUGIN_DIR"
  echo "  Check openclaw output above for errors."
  exit 1
fi
echo "   ✓ Plugin installed to $PLUGIN_DIR"
echo

# ── 5. Auto-configure openclaw.json ─────────────────────────────────────────

echo "5. Configuring openclaw.json..."

if [ ! -f "$OPENCLAW_CONFIG" ]; then
  echo "   ⚠ $OPENCLAW_CONFIG not found — skipping auto-config."
  echo "   Create it with: openclaw doctor"
else
  # Use python3 (already a dependency) for safe JSON manipulation
  python3 - "$OPENCLAW_CONFIG" "$CLAW_ROOT" <<'PYEOF'
import json, sys, os

config_path = sys.argv[1]
claw_root = sys.argv[2]

with open(config_path, "r") as f:
    cfg = json.load(f)

changed = False

# --- Remove duplicate load.paths pointing to claw plugin ---
load_paths = cfg.get("plugins", {}).get("load", {}).get("paths", [])
claw_plugin_path = os.path.join(claw_root, "plugin")
cleaned_paths = [p for p in load_paths if os.path.normpath(p) != os.path.normpath(claw_plugin_path)]
if len(cleaned_paths) != len(load_paths):
    if cleaned_paths:
        cfg["plugins"]["load"]["paths"] = cleaned_paths
    else:
        # Remove empty paths list / load section
        cfg["plugins"]["load"].pop("paths", None)
        if not cfg["plugins"]["load"]:
            cfg["plugins"].pop("load", None)
    changed = True
    print("   ✓ Removed duplicate load path: " + claw_plugin_path)

# --- Ensure plugins.entries.claw-core exists with config ---
entries = cfg.setdefault("plugins", {}).setdefault("entries", {})
claw_entry = entries.get("claw-core", {})
if not claw_entry.get("enabled"):
    claw_entry["enabled"] = True
    changed = True
if "config" not in claw_entry:
    claw_entry["config"] = {}
if claw_entry["config"].get("sourcePath") != claw_root:
    claw_entry["config"]["sourcePath"] = claw_root
    changed = True
if not claw_entry["config"].get("autoStart"):
    claw_entry["config"]["autoStart"] = True
    changed = True
entries["claw-core"] = claw_entry

# --- Ensure skill entries are enabled ---
skill_entries = cfg.setdefault("skills", {}).setdefault("entries", {})
skills_list_path = os.path.join(claw_root, "scripts", "claw-core-skills.list")
if os.path.isfile(skills_list_path):
    with open(skills_list_path) as sf:
        for line in sf:
            name = line.strip()
            if not name or name.startswith("#"):
                continue
            if name not in skill_entries or not skill_entries[name].get("enabled"):
                skill_entries[name] = {"enabled": True}
                changed = True

if changed:
    with open(config_path, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("   ✓ openclaw.json updated")
else:
    print("   ✓ openclaw.json already configured")
PYEOF
fi
echo

# ── Done ─────────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ claw-core installed."
echo ""
echo "Next: Restart the OpenClaw gateway to load the plugin."
echo "Verify: ./scripts/verify_integration.sh"
