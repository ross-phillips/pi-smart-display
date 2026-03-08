#!/bin/bash
# Stable kiosk launcher — called by ~/.xinitrc on startx

export DISPLAY=:0
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export XAUTHORITY=/home/ross/.Xauthority

# Keep display always on (no sensor required)
xset -dpms
xset s off
xset s noblank
vcgencmd display_power 1 2>/dev/null || true

# Force full 4K framebuffer on HDMI-2
xrandr --output HDMI-2 --primary --mode 3840x2160 --rate 30 --pos 0x0 --scale 1x1 --fb 3840x2160

# Hide mouse cursor after 1s of inactivity
unclutter -idle 1 -root &

pkill -f chromium 2>/dev/null || true
sleep 2

# Restart loop — if Chromium exits for any reason, relaunch it
while true; do
  chromium-browser \
    --kiosk \
    --window-size=3840,2160 \
    --window-position=0,0 \
    --no-sandbox \
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
