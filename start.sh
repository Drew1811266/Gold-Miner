#!/usr/bin/env sh
set -eu

# One-click launcher (Linux/macOS)
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PORT="${PORT:-5173}"
TARGET="http://127.0.0.1:$PORT/"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the local static server."
  exit 1
fi

echo "Starting Gold Miner at $TARGET"
echo "Press Ctrl+C in this terminal to stop the local server."
echo ""

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SCRIPT_DIR" >/tmp/gold-miner-http.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup INT TERM EXIT

sleep 0.5

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$TARGET" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$TARGET"
else
  echo "Cannot find a browser opener (xdg-open/open)."
  echo "Open this URL manually: $TARGET"
fi

wait "$SERVER_PID"
