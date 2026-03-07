#!/bin/bash
# Setup PIR Motion Detection for Smart Display

echo "Setting up PIR motion detection..."

# Install required packages
sudo apt-get update
sudo apt-get install -y python3-rpi.gpio

# Make the script executable
chmod +x motion-detection.py

# Install the systemd service
sudo cp motion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable motion.service

echo "Motion detection setup complete!"
echo ""
echo "To start the service:"
echo "  sudo systemctl start motion.service"
echo ""
echo "To check status:"
echo "  sudo systemctl status motion.service"
echo ""
echo "To view logs:"
echo "  tail -f ${PI_DISPLAY_HOME:-/opt/pi-smart-display}/ops/logs/motion.log"
echo ""
echo "Make sure your PIR sensor is connected to GPIO pin 17"
