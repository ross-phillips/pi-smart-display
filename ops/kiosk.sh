#!/usr/bin/env bash
set -e
xset -dpms
xset s off
xset s noblank

# Wait for Docker and services to start
sleep 15

URL="http://localhost:5173"
SCALE="1.25"
ARGS=(--noerrdialogs --disable-infobars --kiosk "$URL" --force-device-scale-factor="$SCALE")

if command -v /snap/bin/chromium >/dev/null; then
  exec /snap/bin/chromium "${ARGS[@]}"
elif command -v chromium >/dev/null; then
  exec chromium "${ARGS[@]}"
else
  echo "Chromium not found. Install via 'sudo snap install chromium' or 'sudo apt install chromium'" >&2
  exit 1
fi
