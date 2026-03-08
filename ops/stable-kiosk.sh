#!/bin/bash
# Stable kiosk launcher — called by ~/.xinitrc on startx

export DISPLAY=:0
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

# Keep display always on (no sensor required)
xset -dpms
xset s off
xset s noblank

# Turn HDMI output on in case it was blanked
vcgencmd display_power 1 2>/dev/null || true

# Hide mouse cursor after 1s of inactivity
unclutter -idle 1 -root &

pkill -f chromium 2>/dev/null || true
sleep 1

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
  --user-data-dir=/tmp/chrome-kiosk \
  http://localhost:8787
