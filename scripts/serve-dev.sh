#!/usr/bin/env bash
# Serve Dioxus landing (grey UI) and mdBook locally for dev.
# Landing: http://localhost:8080
# Book:    http://localhost:3001 (override: BOOK_PORT=3002 ./scripts/serve-dev.sh)

set -e
cd "$(dirname "$0")/.."

# Check for Dioxus CLI
if ! command -v dx &>/dev/null; then
  echo "❌ Dioxus CLI (dx) not found. Install: cargo install dioxus-cli --locked"
  exit 1
fi

echo "Starting Dioxus landing on http://localhost:8080"
echo "  (first build may take 1-2 min...)"
if ! dx build --platform web --package claw-web --debug-symbols true; then
  echo "❌ Dioxus build failed. Fix errors above, then retry."
  exit 1
fi

BOOK_PORT="${BOOK_PORT:-3001}"
if ! command -v mdbook &>/dev/null; then
  echo "Installing mdbook..."
  cargo install mdbook
fi

echo ""
echo "  Landing (Dioxus):  http://localhost:8080"
echo "  Book:             http://localhost:$BOOK_PORT"
echo "  Ctrl+C to stop both"
echo ""

# Run both servers together with concurrently (keeps both alive, clean output)
npx --yes concurrently \
  -n "dioxus,book" \
  -c "cyan,yellow" \
  "dx serve --platform web --package claw-web --port 8080" \
  "mdbook serve book --port $BOOK_PORT"
