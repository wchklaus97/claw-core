#!/bin/sh
# Wrapper that routes shell -c "command" through claw_core when the socket exists.
# Use as OpenClaw's exec shell so every Telegram-triggered command goes through claw_core:
#   export SHELL=/path/to/claw/scripts/claw_core_shell_wrapper.sh
#   export CLAW_ROOT=/path/to/claw  # or script auto-detects from its own path
#   openclaw gateway
#
# Expects: $1 = -c, $2 = the command string. Cwd is set by the caller (gateway).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAW_CORE_EXEC="${CLAW_CORE_EXEC:-$SCRIPT_DIR/claw_core_exec.py}"
CLAW_SOCKET="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"
FALLBACK_SHELL="${CLAW_SHELL_FALLBACK:-/bin/zsh}"
DEFAULT_TIMEOUT="${CLAW_WRAPPER_TIMEOUT:-300}"

if [ "$1" != "-c" ] || [ -z "${2:-}" ]; then
  # Not invoked as shell -c "command"; run fallback shell with all args
  exec "$FALLBACK_SHELL" "$@"
fi

CMD="$2"
CWD="$(pwd)"

if [ -S "$CLAW_SOCKET" ] && [ -f "$CLAW_CORE_EXEC" ]; then
  if command -v python3 >/dev/null 2>&1; then
    exec python3 "$CLAW_CORE_EXEC" --cwd "$CWD" --timeout "$DEFAULT_TIMEOUT" -- sh -c "$CMD"
  fi
fi

exec "$FALLBACK_SHELL" -c "$CMD"
