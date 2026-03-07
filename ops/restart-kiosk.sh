#!/bin/bash
# Script to restart both the server and kiosk browser

echo "Restarting smart display system..."

# Restart PM2 server
echo "Restarting server..."
pm2 restart pi-smart-display

# Wait for server to be ready
sleep 3

# Restart the stable kiosk service
echo "Restarting stable kiosk browser..."
sudo systemctl restart kiosk-stable.service

echo "Smart display system restarted!"
