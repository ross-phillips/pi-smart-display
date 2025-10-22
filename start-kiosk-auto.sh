#!/bin/bash
# Wait for the server to be ready
sleep 10

# Start the kiosk browser with proper display settings
export DISPLAY=:0
chromium-browser --kiosk --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage --user-data-dir=/tmp/chrome-kiosk --force-device-scale-factor=1.0 --disable-features=TranslateUI --disable-ipc-flooding-protection --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding http://localhost:8787
