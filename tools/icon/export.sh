#!/usr/bin/env bash
# Renders the icon layers to assets/ with headless Edge (the dev server must be running:
# npm run dev), then writes the Android launcher icons and the Play Store icon.
set -euo pipefail
cd "$(dirname "$0")/../.."
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
URL="http://localhost:5173/tools/icon/export.html"
mkdir -p assets
for part in icon-only icon-foreground icon-background; do
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=3000 \
    --window-size=1024,1024 --screenshot="$(cygpath -w "$PWD/assets/$part.png")" "$URL?part=$part"
done
node tools/icon/android.mjs
