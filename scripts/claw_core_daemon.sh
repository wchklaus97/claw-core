#!/bin/bash
# claw_core daemon management script
# Usage: ./claw_core_daemon.sh {start|stop|restart|status}
# Env: CLAW_ROOT (default: parent of script dir)

CLAW_CORE_DIR="${CLAW_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SOCKET_PATH="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"
PID_FILE="/tmp/claw_core.pid"
LOG_FILE="/tmp/claw_core.log"

start() {
  if [ -S "$SOCKET_PATH" ]; then
    echo "✓ claw_core already running on $SOCKET_PATH"
    return 0
  fi
  
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
      echo "✓ claw_core already running (PID: $OLD_PID)"
      return 0
    else
      echo "Cleaning up stale PID file..."
      rm -f "$PID_FILE"
    fi
  fi
  
  echo "Starting claw_core..."
  
  # Use pre-compiled binary if available, otherwise build
  BINARY="$CLAW_CORE_DIR/target/release/claw_core"
  if [ -x "$BINARY" ]; then
    echo "Using pre-compiled binary: $BINARY"
    nohup "$BINARY" --socket-path "$SOCKET_PATH" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  else
    echo "Binary not found, building with cargo..."
    cd "$CLAW_CORE_DIR" || exit 1
    nohup cargo run --release -- --socket-path "$SOCKET_PATH" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  fi
  
  # Wait for socket to appear (max 10 seconds)
  for i in {1..20}; do
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
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "Stopping claw_core (PID: $PID)..."
      kill "$PID"
      sleep 1
      
      # Force kill if still running
      if ps -p "$PID" > /dev/null 2>&1; then
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
    echo "No PID file found"
    # Clean up socket if it exists
    if [ -S "$SOCKET_PATH" ]; then
      rm -f "$SOCKET_PATH"
      echo "Cleaned up stale socket"
    fi
  fi
}

status() {
  if [ -S "$SOCKET_PATH" ]; then
    echo "✓ claw_core socket exists: $SOCKET_PATH"
    
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "✓ Process running (PID: $PID)"
      else
        echo "⚠ PID file exists but process not running"
      fi
    else
      echo "⚠ Socket exists but no PID file"
    fi
    
    # Try to ping it
    if command -v python3 >/dev/null 2>&1; then
      if python3 "$CLAW_CORE_DIR/scripts/claw_core_exec.py" --timeout 2 -- echo "ping" >/dev/null 2>&1; then
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

case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop
    sleep 1
    start
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
