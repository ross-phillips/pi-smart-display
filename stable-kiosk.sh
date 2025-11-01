#!/bin/bash
# Bare minimum kiosk browser configuration

echo "Starting minimal kiosk browser..."

# Kill any existing browsers
pkill -f chromium
sleep 2

# Set environment variables
export DISPLAY=:0
export XDG_RUNTIME_DIR=/run/user/1000

# Start Chromium with bare minimum flags (removed flags that cause white screens)
chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions \
  --disable-sync \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --enable-features=NetworkService \
  --disable-software-rasterizer \
  --force-device-scale-factor=1.0 \
  --user-data-dir=/tmp/chrome-kiosk-minimal \
  http://localhost:8787

echo "Minimal kiosk browser started!"
