#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="黄金矿工"
EXEC_NAME="GoldMiner"
OUT_DIR="$ROOT_DIR/dist/macos"
APP_DIR="$OUT_DIR/$APP_NAME.app"

mkdir -p "$OUT_DIR"
rm -rf "$APP_DIR"

mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"

# Copy web game assets into the app bundle.
cp "$ROOT_DIR/index.html" "$APP_DIR/Contents/Resources/index.html"
cp "$ROOT_DIR/styles.css" "$APP_DIR/Contents/Resources/styles.css"
cp "$ROOT_DIR/game.js" "$APP_DIR/Contents/Resources/game.js"
cp "$ROOT_DIR/audio.js" "$APP_DIR/Contents/Resources/audio.js"
cp -R "$ROOT_DIR/src" "$APP_DIR/Contents/Resources/src"
if [[ -f "$SCRIPT_DIR/AppIcon.icns" ]]; then
  cp "$SCRIPT_DIR/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
fi

MODULE_CACHE_DIR="$OUT_DIR/.build-cache"
mkdir -p "$MODULE_CACHE_DIR"

swiftc -O \
  -parse-as-library \
  -framework Cocoa \
  -framework WebKit \
  -Xcc -fmodules-cache-path="$MODULE_CACHE_DIR/clang-modules" \
  -module-cache-path "$MODULE_CACHE_DIR/swift-modules" \
  "$SCRIPT_DIR/GoldMinerApp.swift" \
  -o "$APP_DIR/Contents/MacOS/$EXEC_NAME"

chmod +x "$APP_DIR/Contents/MacOS/$EXEC_NAME" || true

echo "✅ 已生成应用："
echo "$APP_DIR"
echo ""
echo "提示：如果 macOS 提示“无法打开”，请在 Finder 中右键该 App → 打开。"

if [[ "${1:-}" == "--zip" ]]; then
  ZIP_NAME="$APP_NAME-macOS.zip"
  ZIP_PATH="$OUT_DIR/$ZIP_NAME"
  rm -f "$ZIP_PATH"
  ditto -c -k --keepParent "$APP_DIR" "$ZIP_PATH"
  echo ""
  echo "✅ 已生成 ZIP："
  echo "$ZIP_PATH"
  exit 0
fi

if [[ "${1:-}" == "--dmg" ]]; then
  DMG_NAME="$APP_NAME-macOS.dmg"
  DMG_PATH="$OUT_DIR/$DMG_NAME"
  STAGING="$OUT_DIR/dmg-staging"

  rm -f "$DMG_PATH"
  rm -rf "$STAGING"
  mkdir -p "$STAGING"
  cp -R "$APP_DIR" "$STAGING/"
  ln -s /Applications "$STAGING/Applications"

  if ! hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$STAGING" \
    -ov \
    -format UDZO \
    "$DMG_PATH" >/dev/null; then
    rm -rf "$STAGING"
    echo ""
    echo "⚠️  DMG 生成失败（hdiutil）。你仍可使用 .app 或改用 ZIP："
    echo "./macos/build.command --zip"
    exit 1
  fi

  rm -rf "$STAGING"
  echo ""
  echo "✅ 已生成 DMG："
  echo "$DMG_PATH"
fi
