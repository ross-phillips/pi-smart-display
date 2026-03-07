# Raspberry Pi Kiosk Deployment

## Prerequisites
- Raspberry Pi 4 (recommended) with Raspberry Pi OS
- Node.js 18+ installed
- Git installed

## Installation Steps

### 1. Install Node.js (if not already installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone and Setup Project
```bash
cd /home/pi
git clone <your-repo-url> pi-smart-display
cd pi-smart-display
npm install
```

### 3. Build for Production
```bash
npm run build
```

### 4. Install PM2 for Process Management
```bash
sudo npm install -g pm2
```

### 5. Create PM2 Configuration
Create `ecosystem.config.js` in project root:

```javascript
module.exports = {
  apps: [{
    name: 'pi-smart-display',
    script: 'server/server.js',
    cwd: '/home/pi/pi-smart-display',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 6. Start the Application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Setup Kiosk Mode
Install required packages:
```bash
sudo apt-get update
sudo apt-get install -y xserver-xorg-video-all xserver-xorg-input-all xserver-xorg-core
sudo apt-get install -y chromium-browser unclutter
```

### 8. Configure Auto-login and Kiosk
Edit `/etc/lightdm/lightdm.conf`:
```ini
[SeatDefaults]
autologin-user=pi
autologin-user-timeout=0
```

Create kiosk script `/home/pi/start-kiosk.sh`:
```bash
#!/bin/bash
# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide cursor
unclutter -idle 0.5 -root &

# Start browser in kiosk mode
chromium-browser --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --disable-dev-shm-usage --no-sandbox --disable-gpu --start-fullscreen http://localhost:3000
```

Make it executable:
```bash
chmod +x /home/pi/start-kiosk.sh
```

### 9. Configure Desktop Autostart
Create `/home/pi/.config/autostart/kiosk.desktop`:
```ini
[Desktop Entry]
Type=Application
Name=Smart Display Kiosk
Exec=/home/pi/start-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
```

### 10. Reboot and Test
```bash
sudo reboot
```

## Troubleshooting

### Check if app is running:
```bash
pm2 status
pm2 logs pi-smart-display
```

### Restart app:
```bash
pm2 restart pi-smart-display
```

### Check browser logs:
Press F12 in kiosk mode (if possible) or check:
```bash
journalctl -f | grep chromium
```

## Network Access
The app will be available at `http://localhost:3000` on the Pi, or `http://<pi-ip>:3000` from other devices on the network.

## Auto-update (Optional)
Create a simple update script `/home/pi/update-display.sh`:
```bash
#!/bin/bash
cd /home/pi/pi-smart-display
git pull
npm run build
pm2 restart pi-smart-display
```

Add to crontab for daily updates:
```bash
crontab -e
# Add: 0 2 * * * /home/pi/update-display.sh
```
