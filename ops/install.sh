#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${PI_DISPLAY_HOME:-/opt/pi-smart-display}
APP_USER=${PI_DISPLAY_USER:-pi}
APP_PORT=${PI_DISPLAY_PORT:-8787}
REPO_URL=${REPO_URL:-""}

if [[ -z "$REPO_URL" ]]; then
  echo "REPO_URL is required. Example: REPO_URL=https://github.com/org/pi-smart-display.git" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git nodejs npm chromium-browser unclutter

if [[ ! -d "$APP_DIR" ]]; then
  sudo git clone "$REPO_URL" "$APP_DIR"
else
  echo "Repo already exists at $APP_DIR"
fi

sudo chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

cd "$APP_DIR"

mkdir -p "$APP_DIR/data" "$APP_DIR/ops/logs"

cp "backend/server/.env.example" "backend/server/.env" || true

cat > "$APP_DIR/ops/env.sh" <<EOF
#!/usr/bin/env bash
export PI_DISPLAY_HOME=${APP_DIR}
export PI_DISPLAY_USER=${APP_USER}
export PI_DISPLAY_PORT=${APP_PORT}
EOF

sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/frontend' && npm install && npm run build"

sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/backend/server' && npm install"

cd "$APP_DIR"
sudo chmod +x "$APP_DIR/ops/env.sh"

sudo cp "ops/pi-smart-display.service" "/etc/systemd/system/pi-smart-display.service"
sudo cp "ops/kiosk-stable.service" "/etc/systemd/system/kiosk-stable.service"
sudo cp "ops/resolution.service" "/etc/systemd/system/resolution.service"
sudo cp "ops/motion.service" "/etc/systemd/system/motion.service"
sudo cp "ops/network-monitor.service" "/etc/systemd/system/network-monitor.service"
sudo systemctl daemon-reload
sudo systemctl enable --now pi-smart-display.service
sudo systemctl enable --now kiosk-stable.service
sudo systemctl enable --now resolution.service

sudo chmod +x "ops/stable-kiosk.sh"

echo "Install complete."
echo "Open http://<pi-ip>:5173/settings to configure."
