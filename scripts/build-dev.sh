#!/usr/bin/env bash
# Build the Dioxus web app in debug mode (development).
# Use run-dev.sh to build + serve with hot reload, or serve-dev.sh for landing + book.
#
# Usage: ./scripts/build-dev.sh

set -e
cd "$(dirname "$0")/.."

if ! command -v dx &>/dev/null; then
  echo "❌ Dioxus CLI (dx) not found. Install: cargo install dioxus-cli --locked"
  exit 1
fi

echo "🔨 Building Dioxus web app (debug)..."
dx build --platform web --package claw-web --debug-symbols "${DX_DEBUG_SYMBOLS:-true}"

VIDEO_SRC="apps/web/assets/claw-shrimp-box-breakout-v1.mp4"
VIDEO_DST="target/dx/claw-web/debug/web/public/claw-shrimp-box-breakout-v1.mp4"
if [ -f "$VIDEO_SRC" ]; then
  cp "$VIDEO_SRC" "$VIDEO_DST"
  echo "✅ Copied hero video to debug public output"
fi

echo "✅ Build done (target/dx/claw-web/debug/web/public)"
