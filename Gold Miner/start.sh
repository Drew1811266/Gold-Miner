#!/usr/bin/env sh
set -eu

# One-click launcher (Linux/macOS)
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$SCRIPT_DIR/index.html" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$SCRIPT_DIR/index.html"
else
  echo "Cannot find a browser opener (xdg-open/open)."
  echo "Open this file manually: $SCRIPT_DIR/index.html"
  exit 1
fi

