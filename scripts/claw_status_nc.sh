#!/bin/bash
# Ultra-lightweight claw_core status using nc (no Python fork, minimal resources)
SOCKET="${CLAW_CORE_SOCKET:-/tmp/trl.sock}"

if [ ! -S "$SOCKET" ]; then
  echo "❌ claw_core NOT RUNNING (socket not found: $SOCKET)"
  exit 1
fi

ID=$(uuidgen 2>/dev/null || echo "req-$$-$RANDOM")

# Query stats
STATS=$(echo "{\"id\":\"$ID-stats\",\"method\":\"system.stats\",\"params\":{}}" | nc -U "$SOCKET" 2>/dev/null | head -1)

# Query sessions
SESSIONS=$(echo "{\"id\":\"$ID-list\",\"method\":\"session.list\",\"params\":{}}" | nc -U "$SOCKET" 2>/dev/null | head -1)

# Parse and display (simple text output)
echo "=================================================="
echo " CLAW_CORE STATUS (via nc - no fork)"
echo "=================================================="
echo ""
echo "[Runtime]"

if echo "$STATS" | grep -q '"ok":true'; then
  echo "  Status:    ✅ RUNNING"
  UPTIME=$(echo "$STATS" | grep -o '"uptime_s":[0-9]*' | cut -d: -f2)
  CMDS=$(echo "$STATS" | grep -o '"total_commands_run":[0-9]*' | cut -d: -f2)
  FDS=$(echo "$STATS" | grep -o '"open_fds":[0-9]*' | cut -d: -f2)
  echo "  Uptime:    ${UPTIME}s"
  echo "  Commands:  ${CMDS}"
  if [ -n "$FDS" ]; then
    if [ "$FDS" -gt 1000 ]; then
      echo "  Open FDs:  ${FDS} (⚠️ HIGH)"
    else
      echo "  Open FDs:  ${FDS} (✅ OK)"
    fi
  fi
else
  echo "  Status:    ❌ ERROR (socket not responding)"
fi

echo ""
echo "[Sessions]"
if echo "$SESSIONS" | grep -q '"sessions":\[\]'; then
  echo "  (no active sessions)"
elif echo "$SESSIONS" | grep -q '"ok":true'; then
  COUNT=$(echo "$SESSIONS" | grep -o '"session_id"' | wc -l | tr -d ' ')
  echo "  ${COUNT} active (use 'python3 claw_core_sessions.py list' for details)"
else
  echo "  (query failed)"
fi

echo ""
echo "=================================================="
