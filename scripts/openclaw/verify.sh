#!/usr/bin/env bash
# Run claw_core ↔ OpenClaw verification (wrapper for scripts/verify_integration.sh).
exec "$(dirname "$0")/../verify_integration.sh" "$@"
