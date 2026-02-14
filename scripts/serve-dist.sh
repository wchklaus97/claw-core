#!/usr/bin/env bash
# Serve dist/ so that /book/ serves the docs (no -s). Run from repo root.
# Usage: ./scripts/serve-dist.sh [port]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${1:-3000}"
if [ ! -d "dist" ]; then
  echo "❌ dist/ not found. Run: ./scripts/build-github.sh"
  exit 1
fi
if lsof -i ":$PORT" -t >/dev/null 2>&1; then
  echo "❌ Port $PORT is in use. Stop that process (e.g. Ctrl+C in its terminal) or run: $0 <port>"
  exit 1
fi
echo "Serving dist/ at http://localhost:$PORT (no -s; /en/book/, /zh-Hans/book/, /zh-Hant/book/ serve the docs)"
echo "Press Ctrl+C to stop"
exec npx serve dist -p "$PORT"
