#!/usr/bin/env bash
# Copy plugin skills to ~/.openclaw/skills/ so OpenClaw can load them.
# Run from plugin root (e.g. postinstall).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC="$PLUGIN_ROOT/skills"
TARGET="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"

if [ ! -d "$SKILLS_SRC" ]; then
  echo "install-skills: skills dir not found: $SKILLS_SRC"
  exit 0
fi

mkdir -p "$TARGET"
for skill in "$SKILLS_SRC"/*; do
  [ -d "$skill" ] || continue
  name="$(basename "$skill")"
  dest="$TARGET/$name"
  if [ -d "$dest" ]; then
    # Merge: copy SKILL.md and any new files, preserve user customizations
    cp -f "$skill/SKILL.md" "$dest/SKILL.md" 2>/dev/null || true
    for f in "$skill"/*; do
      [ -e "$f" ] && [ -f "$f" ] && cp -f "$f" "$dest/" 2>/dev/null || true
    done
  else
    cp -R "$skill" "$dest"
  fi
  echo "  ✓ $name"
done
echo "Installed skills to $TARGET"
