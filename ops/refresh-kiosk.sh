#!/bin/bash
# Script to refresh the kiosk browser

# Kill the current kiosk browser
pkill -f chromium

# Wait a moment
sleep 2

# Start the kiosk browser again
export DISPLAY=:0
export XDG_RUNTIME_DIR=/run/user/1000

chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --user-data-dir=/tmp/chrome-kiosk \
  --force-device-scale-factor=1.0 \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  http://localhost:8787 &

echo "Kiosk browser refreshed"
