#!/bin/bash
# claw_core daemon management (plugin install)
# Usage: ./claw_core_daemon.sh {start|stop|restart|status}
# Env: CLAW_CORE_BINARY, CLAW_CORE_SOCKET, CLAW_CORE_SOURCE, CLAW_CORE_PLUGIN_ROOT

SOCKET_PATH="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"
PID_FILE="/tmp/claw_core.pid"
LOG_FILE="/tmp/claw_core.log"
PLUGIN_ROOT="${CLAW_CORE_PLUGIN_ROOT:-$(dirname "$0")/..}"

find_binary() {
  if [ -n "$CLAW_CORE_BINARY" ] && [ -x "$CLAW_CORE_BINARY" ]; then
    echo "$CLAW_CORE_BINARY"
    return 0
  fi
  if [ -x "$PLUGIN_ROOT/bin/claw_core" ]; then
    echo "$PLUGIN_ROOT/bin/claw_core"
    return 0
  fi
  if [ -x "$PLUGIN_ROOT/bin/claw_core.exe" ]; then
    echo "$PLUGIN_ROOT/bin/claw_core.exe"
    return 0
  fi
  if command -v claw_core >/dev/null 2>&1; then
    command -v claw_core
    return 0
  fi
  if [ -x "$HOME/.cargo/bin/claw_core" ]; then
    echo "$HOME/.cargo/bin/claw_core"
    return 0
  fi
  if [ -n "$CLAW_CORE_SOURCE" ] && [ -d "$CLAW_CORE_SOURCE" ]; then
    local bin="$CLAW_CORE_SOURCE/target/release/claw_core"
    if [ -x "$bin" ]; then
      echo "$bin"
      return 0
    fi
  fi
  return 1
}

start() {
  if [ -S "$SOCKET_PATH" ]; then
    echo "✓ claw_core already running on $SOCKET_PATH"
    return 0
  fi

  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" >/dev/null 2>&1; then
      echo "✓ claw_core already running (PID: $OLD_PID)"
      return 0
    else
      echo "Cleaning up stale PID file..."
      rm -f "$PID_FILE"
    fi
  fi

  # Ensure plugin binary exists (OpenClaw extracts packages without running npm postinstall)
  if [ -z "$CLAW_CORE_BINARY" ] && [ -z "$CLAW_CORE_SOURCE" ] && [ ! -x "$PLUGIN_ROOT/bin/claw_core" ]; then
    DOWNLOAD_SH="$PLUGIN_ROOT/scripts/postinstall-download-binary.sh"
    CONFIG_JS="$PLUGIN_ROOT/scripts/postinstall-config-openclaw.cjs"
    if [ -f "$DOWNLOAD_SH" ]; then
      echo "Downloading claw_core binary (OpenClaw does not run postinstall)..."
      CLAW_CORE_PLUGIN_ROOT="$PLUGIN_ROOT" bash "$DOWNLOAD_SH" 2>/dev/null || true
      [ -f "$CONFIG_JS" ] && node "$CONFIG_JS" 2>/dev/null || true
      INSTALL_SKILLS="$PLUGIN_ROOT/scripts/install-skills-to-openclaw.sh"
      [ -f "$INSTALL_SKILLS" ] && bash "$INSTALL_SKILLS" 2>/dev/null || true
      CURSOR_SETUP="$PLUGIN_ROOT/scripts/setup-cursor-integration.cjs"
      [ -f "$CURSOR_SETUP" ] && node "$CURSOR_SETUP" 2>/dev/null || true
    fi
  fi

  echo "Starting claw_core..."

  BINARY=$(find_binary)
  if [ -n "$BINARY" ]; then
    nohup "$BINARY" --socket-path "$SOCKET_PATH" >>"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  elif [ -n "$CLAW_CORE_SOURCE" ] && [ -d "$CLAW_CORE_SOURCE" ]; then
    echo "Building from source: $CLAW_CORE_SOURCE"
    (cd "$CLAW_CORE_SOURCE" && nohup cargo run --release -- --socket-path "$SOCKET_PATH" >>"$LOG_FILE" 2>&1 &)
    echo $! >"$PID_FILE"
  else
    echo "✗ claw_core binary not found. Install with: cargo install claw_core"
    echo "  Or set CLAW_CORE_BINARY, CLAW_CORE_SOURCE, or ensure claw_core is in PATH."
    return 1
  fi

  for i in $(seq 1 20); do
    if [ -S "$SOCKET_PATH" ]; then
      echo "✓ claw_core started (PID: $(cat "$PID_FILE"))"
      echo "  Socket: $SOCKET_PATH"
      echo "  Logs: $LOG_FILE"
      return 0
    fi
    sleep 0.5
  done

  echo "✗ Failed to start claw_core (socket not created)"
  return 1
}

stop() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" >/dev/null 2>&1; then
      echo "Stopping claw_core (PID: $PID)..."
      kill "$PID"
      sleep 1
      if ps -p "$PID" >/dev/null 2>&1; then
        echo "Force killing claw_core..."
        kill -9 "$PID"
      fi
      rm -f "$PID_FILE"
      rm -f "$SOCKET_PATH"
      echo "✓ claw_core stopped"
    else
      echo "Process not running, cleaning up..."
      rm -f "$PID_FILE"
      rm -f "$SOCKET_PATH"
    fi
  else
    if [ -S "$SOCKET_PATH" ]; then
      rm -f "$SOCKET_PATH"
      echo "Cleaned up stale socket"
    else
      echo "No PID file found"
    fi
  fi
}

status() {
  if [ -S "$SOCKET_PATH" ]; then
    echo "✓ claw_core socket exists: $SOCKET_PATH"
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" >/dev/null 2>&1; then
        echo "✓ Process running (PID: $PID)"
      else
        echo "⚠ PID file exists but process not running"
      fi
    fi
    EXEC_PY="$PLUGIN_ROOT/scripts/claw_core_exec.py"
    if [ -f "$EXEC_PY" ] && command -v python3 >/dev/null 2>&1; then
      if CLAW_CORE_SOCKET="$SOCKET_PATH" python3 "$EXEC_PY" --timeout 2 -- echo "ping" >/dev/null 2>&1; then
        echo "✓ claw_core responding to commands"
      else
        echo "✗ claw_core not responding"
      fi
    fi
  else
    echo "✗ claw_core not running (socket not found)"
    return 1
  fi
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; sleep 1; start ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac
