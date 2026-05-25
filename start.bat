@echo off
setlocal

rem One-click launcher (Windows)
set "SCRIPT_DIR=%~dp0"
set "PORT=5173"
set "TARGET=http://127.0.0.1:%PORT%/"

echo Starting Gold Miner at %TARGET%
echo Press Ctrl+C in this window to stop the local server.
echo.

start "" "%TARGET%"
py -3 -m http.server %PORT% --bind 127.0.0.1 --directory "%SCRIPT_DIR%"
if errorlevel 1 (
  python -m http.server %PORT% --bind 127.0.0.1 --directory "%SCRIPT_DIR%"
)
