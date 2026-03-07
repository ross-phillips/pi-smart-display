#!/bin/bash

echo "Setting up network monitoring service..."

# Make the Python script executable
chmod +x ${PI_DISPLAY_HOME:-/opt/pi-smart-display}/ops/network-monitor.py

# Copy the systemd service file
echo "Copying network-monitor.service to systemd..."
sudo cp network-monitor.service /etc/systemd/system/

# Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable the service to start on boot
echo "Enabling network-monitor.service to start on boot..."
sudo systemctl enable network-monitor.service

# Start the service
echo "Starting network-monitor.service..."
sudo systemctl start network-monitor.service

echo "Setup complete! Network monitoring service is now running."
echo ""
echo "To check its status:"
echo "  sudo systemctl status network-monitor.service"
echo ""
echo "To view logs:"
echo "  tail -f ${PI_DISPLAY_HOME:-/opt/pi-smart-display}/ops/logs/network-monitor.log"
echo ""
echo "To stop the service:"
echo "  sudo systemctl stop network-monitor.service"
echo ""
echo "The service will:"
echo "- Check connectivity every 30 seconds"
echo "- Restart network service after 3 consecutive failures"
echo "- Log all activity to network-monitor.log"
