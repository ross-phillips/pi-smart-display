#!/bin/bash
# Raspberry Pi Kiosk Startup Script

# Disable screen blanking and power management
xset s off
xset -dpms
xset s noblank

# Hide cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Wait for network to be ready
sleep 5

# Start Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-dev-shm-usage \
  --no-sandbox \
  --disable-gpu \
  --start-fullscreen \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  # DO NOT add --disable-web-security — CORS is handled by the backend server.
  http://localhost:8787
