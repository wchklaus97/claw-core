#!/usr/bin/env bash
# Verification script for claw_core ↔ OpenClaw integration.
# Checks if all components are properly configured.
#
# Usage:
#   ./scripts/verify_integration.sh            # Run all checks
#   ./scripts/verify_integration.sh --strict   # Treat warnings as failures (for CI)
#   ./scripts/verify_integration.sh --help     # Show usage
#
# Environment:
#   CLAW_ROOT           — claw repo path (default: parent of scripts/)
#   OPENCLAW_WORKSPACE  — workspace where BOOT.md may live (default: CLAW_ROOT)
#   OPENCLAW_PLUGIN_DIR — plugin install dir (default: ~/.openclaw/extensions/claw-core)
#   CLAW_CORE_SOCKET    — daemon socket path (default: /tmp/trl.sock)
#
# Note: This script intentionally omits "set -euo pipefail" because it needs to
# continue running after individual check failures to produce a full report.

CLAW_ROOT="${CLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
WORKSPACE="${OPENCLAW_WORKSPACE:-$CLAW_ROOT}"
PLUGIN_DIR="${OPENCLAW_PLUGIN_DIR:-$HOME/.openclaw/extensions/claw-core}"
SKILLS_DIR="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"
OPENCLAW_CONFIG="$HOME/.openclaw/openclaw.json"
SKILLS_LIST="$CLAW_ROOT/scripts/claw-core-skills.list"
SOCKET_PATH="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"

STRICT=false

# ── Parse arguments ──────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Verifies claw_core ↔ OpenClaw integration."
  echo ""
  echo "Options:"
  echo "  --strict   Treat warnings as failures (useful for CI)"
  echo "  -h, --help Show this help message"
  echo ""
  echo "Environment:"
  echo "  CLAW_ROOT           Claw repo path (default: auto-detect)"
  echo "  OPENCLAW_WORKSPACE  Workspace for BOOT.md (default: CLAW_ROOT)"
  echo "  OPENCLAW_PLUGIN_DIR Plugin install dir (default: ~/.openclaw/extensions/claw-core)"
  echo "  CLAW_CORE_SOCKET    Daemon socket path (default: /tmp/trl.sock)"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --strict)   STRICT=true ;;
    -h|--help)  usage ;;
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
    line="${line%%#*}"
    line="${line// /}"
    [ -n "$line" ] && CLAW_SKILLS+=("$line")
  done < "$SKILLS_LIST"
else
  CLAW_SKILLS=(claw-core-runtime claw-core-sessions claw-core-daemon cron-helper cursor-agent cursor-cron-bridge plans-mode status-dashboard)
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

echo "🔍 Verifying claw_core ↔ OpenClaw Integration"
echo "   CLAW_ROOT=$CLAW_ROOT"
echo "   PLUGIN_DIR=$PLUGIN_DIR"
echo "   SOCKET=$SOCKET_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

PASS=0
FAIL=0
WARN=0

check_file() {
  local file="$1"
  local desc="$2"
  if [ -f "$file" ]; then
    echo "✓ $desc"
    ((PASS++)) || true
    return 0
  else
    echo "✗ $desc (NOT FOUND: $file)"
    ((FAIL++)) || true
    return 1
  fi
}

check_dir() {
  local dir="$1"
  local desc="$2"
  if [ -d "$dir" ]; then
    echo "✓ $desc"
    ((PASS++)) || true
    return 0
  else
    echo "✗ $desc (NOT FOUND: $dir)"
    ((FAIL++)) || true
    return 1
  fi
}

check_executable() {
  local file="$1"
  local desc="$2"
  if [ -x "$file" ]; then
    echo "✓ $desc"
    ((PASS++)) || true
    return 0
  else
    echo "⚠ $desc (NOT EXECUTABLE: $file)"
    ((WARN++)) || true
    return 1
  fi
}

check_json_key() {
  local file="$1"
  local key="$2"
  local desc="$3"
  if command -v jq >/dev/null 2>&1; then
    if jq -e "$key" "$file" >/dev/null 2>&1; then
      echo "✓ $desc"
      ((PASS++)) || true
      return 0
    else
      echo "✗ $desc (KEY NOT FOUND: $key)"
      ((FAIL++)) || true
      return 1
    fi
  elif command -v python3 >/dev/null 2>&1; then
    # Fallback: use python3 for JSON key check
    if python3 -c "
import json, sys
with open('$file') as f: cfg = json.load(f)
# Navigate dotted key like .plugins.entries.\"claw-core\".enabled
keys = '$key'.lstrip('.').replace('\"', '').split('.')
node = cfg
for k in keys:
    node = node[k]
assert node
" 2>/dev/null; then
      echo "✓ $desc"
      ((PASS++)) || true
      return 0
    else
      echo "✗ $desc (KEY NOT FOUND: $key)"
      ((FAIL++)) || true
      return 1
    fi
  else
    echo "⚠ $desc (install jq or python3 for JSON validation)"
    ((WARN++)) || true
    return 0
  fi
}

# ── 1. Boot Hook (optional) ─────────────────────────────────────────────────

echo "1. Boot Hook (optional — plugin uses boot-claw-core hook)"
echo "─────────────────────────────────────────────────────────"
if [ -f "$WORKSPACE/BOOT.md" ]; then
  check_file "$WORKSPACE/BOOT.md" "BOOT.md exists"
  if grep -q "claw_core_daemon.sh start" "$WORKSPACE/BOOT.md" 2>/dev/null; then
    echo "✓ BOOT.md contains claw_core startup command"
    ((PASS++)) || true
  else
    echo "⚠ BOOT.md exists but missing claw_core startup"
    ((WARN++)) || true
  fi
else
  echo "○ BOOT.md not found (skip if using claw-core plugin boot hook)"
  ((WARN++)) || true
fi
echo

# ── 2. Daemon Manager ───────────────────────────────────────────────────────

echo "2. Daemon Manager"
echo "──────────────────"
if [ -f "$PLUGIN_DIR/scripts/claw_core_daemon.sh" ]; then
  check_file "$PLUGIN_DIR/scripts/claw_core_daemon.sh" "Daemon script (plugin)"
  check_executable "$PLUGIN_DIR/scripts/claw_core_daemon.sh" "Daemon script executable"
elif [ -f "$CLAW_ROOT/scripts/claw_core_daemon.sh" ]; then
  check_file "$CLAW_ROOT/scripts/claw_core_daemon.sh" "Daemon script (repo)"
  check_executable "$CLAW_ROOT/scripts/claw_core_daemon.sh" "Daemon script executable"
else
  echo "✗ Daemon script not found (check CLAW_ROOT or PLUGIN_DIR)"
  ((FAIL++)) || true
fi
echo

# ── 3. OpenClaw Configuration ───────────────────────────────────────────────

echo "3. OpenClaw Configuration"
echo "──────────────────────────"
check_file "$OPENCLAW_CONFIG" "openclaw.json exists"
check_json_key "$OPENCLAW_CONFIG" '.hooks.internal.enabled' "Internal hooks enabled"
check_json_key "$OPENCLAW_CONFIG" '.hooks.internal.entries."boot-md".enabled' "boot-md hook enabled"

# Check for duplicate plugin loading (common misconfiguration)
if command -v python3 >/dev/null 2>&1 && [ -f "$OPENCLAW_CONFIG" ]; then
  DUPES=$(python3 -c "
import json, os
with open('$OPENCLAW_CONFIG') as f: cfg = json.load(f)
paths = cfg.get('plugins',{}).get('load',{}).get('paths',[])
has_load = any('claw' in os.path.normpath(p).lower() for p in paths)
has_entry = 'claw-core' in cfg.get('plugins',{}).get('entries',{})
has_install = 'claw-core' in cfg.get('plugins',{}).get('installs',{})
if has_load and (has_entry or has_install):
    print('DUPE')
" 2>/dev/null)
  if [ "$DUPES" = "DUPE" ]; then
    echo "⚠ Duplicate plugin loading detected: claw plugin in both load.paths AND entries/installs"
    echo "  Run install with --force to fix: ./scripts/install-claw-core-openclaw.sh --force"
    ((WARN++)) || true
  fi
fi

# Check skill entries in config
for skill in "${CLAW_SKILLS[@]}"; do
  check_json_key "$OPENCLAW_CONFIG" ".skills.entries.\"$skill\".enabled" "$skill skill enabled"
done
echo

# ── 4. OpenClaw Skills ──────────────────────────────────────────────────────

echo "4. OpenClaw Skills"
echo "───────────────────"
for skill in "${CLAW_SKILLS[@]}"; do
  if [ -d "$PLUGIN_DIR/skills/$skill" ]; then
    check_file "$PLUGIN_DIR/skills/$skill/SKILL.md" "$skill SKILL.md (plugin)"
  elif [ -d "$SKILLS_DIR/$skill" ]; then
    check_file "$SKILLS_DIR/$skill/SKILL.md" "$skill SKILL.md (managed)"
  else
    echo "✗ $skill not found"
    ((FAIL++)) || true
  fi
done
echo

# ── 5. Execution Scripts ────────────────────────────────────────────────────

echo "5. Execution Scripts"
echo "─────────────────────"
EXEC_PY=""
[ -f "$PLUGIN_DIR/scripts/claw_core_exec.py" ] && EXEC_PY="$PLUGIN_DIR/scripts/claw_core_exec.py"
[ -z "$EXEC_PY" ] && [ -f "$CLAW_ROOT/scripts/claw_core_exec.py" ] && EXEC_PY="$CLAW_ROOT/scripts/claw_core_exec.py"
check_file "${EXEC_PY:-$CLAW_ROOT/scripts/claw_core_exec.py}" "Execution wrapper (Python)"
if command -v python3 >/dev/null 2>&1; then
  echo "✓ python3 available"
  ((PASS++)) || true
else
  echo "✗ python3 NOT available (required for wrapper)"
  ((FAIL++)) || true
fi
echo

# ── 6. Documentation (optional) ─────────────────────────────────────────────

echo "6. Documentation (optional)"
echo "────────────────────────────"
DOC_FILE="$CLAW_ROOT/.cursor/docs/OPENCLAW-INTEGRATION.md"
if [ -f "$DOC_FILE" ]; then
  echo "✓ Integration docs found"
  ((PASS++)) || true
else
  echo "○ Integration docs not found (optional: $DOC_FILE)"
  # Not a warning or failure — docs are optional for release installs
fi
echo

# ── 7. Runtime Status ───────────────────────────────────────────────────────

echo "7. Runtime Status"
echo "──────────────────"
if [ -S "$SOCKET_PATH" ]; then
  echo "✓ claw_core socket exists ($SOCKET_PATH)"
  ((PASS++)) || true
  EXEC_PY="${EXEC_PY:-$CLAW_ROOT/scripts/claw_core_exec.py}"
  [ -f "$PLUGIN_DIR/scripts/claw_core_exec.py" ] && EXEC_PY="$PLUGIN_DIR/scripts/claw_core_exec.py"
  if [ -f "$EXEC_PY" ] && python3 "$EXEC_PY" --timeout 2 -- echo "test" >/dev/null 2>&1; then
    echo "✓ claw_core responding to commands"
    ((PASS++)) || true
  else
    echo "⚠ Socket exists but claw_core not responding"
    ((WARN++)) || true
  fi
else
  echo "⚠ claw_core not currently running (will start on gateway boot)"
  ((WARN++)) || true
fi
echo

# ── Results ──────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Results:"
echo "   ✓ Passed: $PASS"
echo "   ⚠ Warnings: $WARN"
echo "   ✗ Failed: $FAIL"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "❌ Integration has issues. Please review failed checks above."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  if [ "$STRICT" = true ]; then
    echo "❌ Warnings treated as failures (--strict mode)"
    exit 1
  else
    echo "✅ Integration is configured (some warnings)"
    exit 0
  fi
else
  echo "🎉 All checks passed! Integration is fully configured."
  exit 0
fi
