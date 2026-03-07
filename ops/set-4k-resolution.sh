#!/bin/bash
# Script to force 4K resolution on Raspberry Pi

# Wait for display to be ready
sleep 2

# Set 4K resolution using xrandr (if available)
if command -v xrandr &> /dev/null; then
    # Get the connected display
    DISPLAY=:0 xrandr --output HDMI-1 --mode 3840x2160 --rate 60 2>/dev/null || true
    DISPLAY=:0 xrandr --output HDMI-A-1 --mode 3840x2160 --rate 60 2>/dev/null || true
    DISPLAY=:0 xrandr --output HDMI-A-2 --mode 3840x2160 --rate 60 2>/dev/null || true
fi

# Alternative: Use fbset to set framebuffer resolution
if command -v fbset &> /dev/null; then
    fbset -g 3840 2160 3840 2160 32 2>/dev/null || true
fi

# Log the resolution setting
echo "$(date): 4K resolution set" >> ${PI_DISPLAY_HOME:-/opt/pi-smart-display}/ops/logs/resolution.log
