#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-5173}"
TARGET="http://127.0.0.1:$PORT/"

echo "Starting Gold Miner at $TARGET"
echo "Press Ctrl+C in this window to stop the local server."
echo ""

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SCRIPT_DIR" >/tmp/gold-miner-http.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sleep 0.5

if ! open "$TARGET" >/dev/null 2>&1; then
  echo "Open this URL manually:"
  echo "$TARGET"
fi

wait "$SERVER_PID"
