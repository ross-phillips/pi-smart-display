# Pi Smart Display - Install Guide

## One-Command Install (Fresh Pi)
1. Run the installer
   - `curl -fsSL <raw-install-url> -o /tmp/install.sh`
   - `REPO_URL=https://github.com/ross-phillips/pi-smart-display.git sudo bash /tmp/install.sh`

## Manual Install (Optional)
1. Install dependencies
   - `sudo apt-get update`
   - `sudo apt-get install -y git nodejs npm chromium-browser unclutter`
2. Clone the repo
   - `git clone <repo-url> /opt/pi-smart-display`
   - `cd /opt/pi-smart-display`
3. Install frontend and backend dependencies
   - `cd frontend && npm install`
   - `cd ../backend/server && npm install`
4. Build the frontend
   - `cd ../../frontend && npm run build`
5. Configure runtime
   - `cp backend/server/.env.example backend/server/.env`
   - Edit `backend/server/.env` as needed
6. Start backend service
   - `sudo cp ops/pi-smart-display.service /etc/systemd/system/`
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now pi-smart-display.service`
7. Start kiosk
   - `chmod +x ops/stable-kiosk.sh`
   - `./ops/stable-kiosk.sh`

## Configure the Display
- Open `http://<pi-ip>:5173/settings` in a browser
- Add calendars, feeds, and location
- Enable/disable modules and layout options

## Optional Services
- Motion detection: `sudo ./ops/setup-motion.sh`
- Network monitor: `sudo ./ops/setup-network-monitor.sh`
- Resolution: `sudo cp ops/resolution.service /etc/systemd/system/ && sudo systemctl enable --now resolution.service`

## Verification Checklist
- `systemctl status pi-smart-display.service`
- Visit `http://<pi-ip>:5173` to confirm display renders
- Visit `http://<pi-ip>:5173/settings` and save a config change
- Confirm weather/news/calendar tiles populate within 2 minutes
