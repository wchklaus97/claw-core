#!/usr/bin/env bash
set -euo pipefail

SOCKET_PATH="${1:-/tmp/trl-smoke.sock}"

cargo run -- --socket-path "$SOCKET_PATH" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in {1..40}; do
  [[ -S "$SOCKET_PATH" ]] && break
  sleep 0.1
done

PING='{"id":"1","method":"system.ping","params":{}}'
CREATE='{"id":"2","method":"session.create","params":{"shell":"/bin/sh","working_dir":"/tmp"}}'

send_req() {
  local payload="$1"
  python3 - "$SOCKET_PATH" "$payload" <<'PY'
import socket
import sys

sock_path = sys.argv[1]
payload = sys.argv[2]
sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.connect(sock_path)
sock.sendall((payload + "\n").encode())
buf = b""
while not buf.endswith(b"\n"):
    chunk = sock.recv(4096)
    if not chunk:
        break
    buf += chunk
sock.close()
print(buf.decode().strip())
PY
}

send_req "$PING"
CREATE_RESP="$(send_req "$CREATE")"
echo "$CREATE_RESP"

SESSION_ID="$(echo "$CREATE_RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["session_id"])')"
RUN_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "id": "3",
  "method": "exec.run",
  "params": {
    "session_id": "$SESSION_ID",
    "command": "echo smoke-ok"
  }
}))
PY
)"
DESTROY_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "id": "4",
  "method": "session.destroy",
  "params": {"session_id": "$SESSION_ID"}
}))
PY
)"

send_req "$RUN_PAYLOAD"
send_req "$DESTROY_PAYLOAD"
