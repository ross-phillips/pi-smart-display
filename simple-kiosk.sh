#!/bin/bash
# Simple, stable kiosk browser configuration

echo "Starting simple stable kiosk browser..."

# Kill any existing browsers
pkill -f chromium
sleep 2

# Set environment variables
export DISPLAY=:0
export XDG_RUNTIME_DIR=/run/user/1000

# Create a clean browser profile
rm -rf /tmp/chrome-kiosk-simple
mkdir -p /tmp/chrome-kiosk-simple

# Start Chromium with minimal, stable flags
chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --user-data-dir=/tmp/chrome-kiosk-simple \
  --force-device-scale-factor=1.0 \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-sync \
  --disable-default-apps \
  --disable-extensions \
  --no-first-run \
  --disable-web-security \
  --disable-background-networking \
  --disable-component-extensions-with-background-pages \
  --disable-background-downloads \
  --disable-client-side-phishing-detection \
  --disable-datasaver-prompt \
  --disable-domain-reliability \
  --disable-hang-monitor \
  --disable-prompt-on-repost \
  --disable-sync-preferences \
  --no-default-browser-check \
  --no-pings \
  --no-service-autorun \
  --password-store=basic \
  --use-mock-keychain \
  --disable-breakpad \
  --disable-crash-reporter \
  --disable-logging \
  --disable-permissions-api \
  --disable-speech-api \
  --disable-file-system \
  --disable-presentation-api \
  --disable-remote-fonts \
  --disable-webgl \
  --disable-webgl2 \
  --disable-3d-apis \
  --disable-accelerated-2d-canvas \
  --disable-accelerated-jpeg-decoding \
  --disable-accelerated-mjpeg-decode \
  --disable-accelerated-video-decode \
  --disable-gpu-compositing \
  --disable-gpu-rasterization \
  --disable-gpu-sandbox \
  --disable-software-rasterizer \
  --disable-threaded-compositing \
  --disable-threaded-scrolling \
  --disable-checker-imaging \
  --disable-image-animation-resync \
  --disable-new-tab-first-run \
  --disable-offer-store-unmasked-wallet-cards \
  --disable-print-preview \
  --disable-speech-synthesis-api \
  --disable-translate \
  --disable-voice-input \
  --disable-wake-on-wifi \
  --enable-aggressive-domstorage-flushing \
  --enable-simple-cache-backend \
  --memory-pressure-off \
  http://localhost:8787

echo "Simple stable kiosk browser started!"
