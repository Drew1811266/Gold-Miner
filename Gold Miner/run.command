#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$SCRIPT_DIR/index.html"

# Try to open in the default browser (normal macOS usage).
if open "$TARGET" >/dev/null 2>&1; then
  exit 0
fi

# Fallback for sandboxed environments where GUI apps can't be launched:
# print a file:// URL that you can copy into a browser.
python3 - <<'PY' "$TARGET"
import pathlib
import sys

path = pathlib.Path(sys.argv[1]).resolve()
print(path.as_uri())
PY
