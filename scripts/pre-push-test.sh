#!/usr/bin/env bash
# Pre-push testing: validates Claw Core and OpenClaw integration before pushing.
# Implements Tiers 1–3 from the Pre-Push Testing Plan.
#
# Usage:
#   ./scripts/pre-push-test.sh           # Tiers 1–2 only (no OpenClaw)
#   ./scripts/pre-push-test.sh --openclaw # Include Tier 3 (verify_integration.sh)
#
# Environment:
#   CLAW_ROOT, OPENCLAW_PLUGIN_DIR, OPENCLAW_WORKSPACE — passed to verify_integration.sh

set -euo pipefail

CLAW_ROOT="${CLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$CLAW_ROOT"

RUN_OPENCLAW=false
for arg in "$@"; do
  case "$arg" in
    --openclaw) RUN_OPENCLAW=true ;;
  esac
done

echo "Pre-push test: Claw Core + OpenClaw integration"
echo "CLAW_ROOT=$CLAW_ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Tier 1: Core runtime
echo "Tier 1: Core runtime (cargo test + smoke.sh)"
echo "──────────────────────────────────────────────"
cargo test
./scripts/smoke.sh
echo

# Tier 2: Build release binary
echo "Tier 2: Build release binary"
echo "──────────────────────────────────────────────"
cargo build --release
echo "  Binary: $CLAW_ROOT/target/release/claw_core"
echo

# Tier 3: OpenClaw verification (optional)
if [ "$RUN_OPENCLAW" = true ]; then
  if command -v openclaw >/dev/null 2>&1; then
    echo "Tier 3: OpenClaw integration verification"
    echo "──────────────────────────────────────────────"
    ./scripts/verify_integration.sh
  else
    echo "Tier 3: Skipped (openclaw not on PATH; use --openclaw only if OpenClaw is installed)"
  fi
else
  echo "Tier 3: Skipped (run with --openclaw to verify OpenClaw integration)"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pre-push test completed successfully."
