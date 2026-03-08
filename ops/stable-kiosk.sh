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

# Read back the actual screen dimensions after mode-set
# --disable-gpu causes Chromium's kiosk to default to 1920x1080 instead of
# filling the X display, so we pass --window-size explicitly.
SCREEN_W=$(xrandr 2>/dev/null | awk '/^Screen 0:/{match($0,/current ([0-9]+) x ([0-9]+)/,a); print a[1]; exit}')
SCREEN_H=$(xrandr 2>/dev/null | awk '/^Screen 0:/{match($0,/current ([0-9]+) x ([0-9]+)/,a); print a[2]; exit}')
SCREEN_W=${SCREEN_W:-1920}
SCREEN_H=${SCREEN_H:-1080}

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
    --window-size=${SCREEN_W},${SCREEN_H} \
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
