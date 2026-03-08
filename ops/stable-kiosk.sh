#!/bin/bash
# Stable kiosk launcher — called by ~/.xinitrc on startx

export DISPLAY=:0
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

# Keep display always on (no sensor required)
xset -dpms
xset s off
xset s noblank
vcgencmd display_power 1 2>/dev/null || true

# Set display resolution — try 4K first, fall back to 1080p, then auto
DISP=$(xrandr 2>/dev/null | awk '/ connected/{print $1; exit}')
if [ -n "$DISP" ]; then
  xrandr --output "$DISP" --mode 3840x2160 2>/dev/null \
    || xrandr --output "$DISP" --mode 1920x1080 2>/dev/null \
    || xrandr --auto
  sleep 1   # let the mode change settle before launching Chromium
else
  xrandr --auto
fi

# Hide mouse cursor after 1s of inactivity
unclutter -idle 1 -root &

pkill -f chromium 2>/dev/null || true
sleep 2

# Restart loop — if Chromium exits for any reason, relaunch it
while true; do
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
    --force-device-scale-factor=1.0 \
    --user-data-dir=/tmp/chrome-kiosk \
    http://localhost:8787
  sleep 2
done
