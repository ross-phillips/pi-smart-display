#!/usr/bin/env bash
# =============================================================================
# Pi Smart Display — Installer
# Run on a fresh Raspberry Pi OS Lite (64-bit) after git clone
#
# Usage (one-liner from a fresh Pi):
#   sudo apt install -y git && git clone https://github.com/ross-phillips/pi-smart-display.git ~/pi-smart-display && cd ~/pi-smart-display && bash install.sh
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

step() { echo -e "\n${BOLD}[$1/8] $2${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
die()  { echo -e "  ${RED}✗${NC}  $1"; exit 1; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     Pi Smart Display — Installer     ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# Guard: must not run as root (PM2 startup works better as the target user)
[ "$EUID" -eq 0 ] && die "Do not run as root. Run as the pi user: bash install.sh"

# =============================================================================
# 0. Bootstrap — ensure git is available (needed if run before clone somehow)
# =============================================================================
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  sudo apt-get update -qq && sudo apt-get install -y git -qq
fi

# =============================================================================
# 1. System update
# =============================================================================
step 1 "Updating system packages"
sudo apt-get update -qq
sudo apt-get full-upgrade -y -qq
ok "System up to date"

# =============================================================================
# 2. Node.js 20 LTS
# =============================================================================
step 2 "Installing Node.js 20 LTS"
NEED_NODE=true
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  [ "$NODE_MAJOR" -ge 20 ] && NEED_NODE=false
fi
if $NEED_NODE; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs -qq
fi
ok "Node $(node -v) / npm $(npm -v)"

# =============================================================================
# 3. System dependencies
# =============================================================================
step 3 "Installing X11, Chromium & tools"
sudo apt-get install --no-install-recommends -y -qq \
  xserver-xorg \
  x11-xserver-utils \
  unclutter

# Chromium package name changed between RPi OS versions:
#   Bullseye / older Bookworm → chromium-browser  (RPi Foundation repo)
#   Newer Bookworm / Trixie   → chromium          (standard Debian repo)
if apt-cache show chromium-browser &>/dev/null 2>&1; then
  sudo apt-get install --no-install-recommends -y -qq chromium-browser
  CHROMIUM_BIN="chromium-browser"
else
  sudo apt-get install --no-install-recommends -y -qq chromium
  CHROMIUM_BIN="chromium"
  # Symlink so kiosk scripts can always call 'chromium-browser'
  if ! command -v chromium-browser &>/dev/null; then
    sudo ln -sf "$(command -v chromium)" /usr/local/bin/chromium-browser
    ok "Symlinked chromium → chromium-browser"
  fi
fi
ok "Chromium $($CHROMIUM_BIN --version 2>/dev/null | awk '{print $2}' || echo 'installed')"

# =============================================================================
# 4. PM2
# =============================================================================
step 4 "Installing PM2 process manager"
sudo npm install -g pm2 --quiet 2>/dev/null
ok "PM2 $(pm2 -v)"

# =============================================================================
# 5. Frontend — install deps and build
# =============================================================================
step 5 "Building frontend"
cd "$REPO_DIR/frontend"
npm install --silent
npm run build --silent
ok "Frontend built → frontend/dist/"

# =============================================================================
# 6. Backend — install deps
# =============================================================================
step 6 "Installing backend dependencies"
cd "$REPO_DIR/backend/server"
npm install --silent
ok "Backend dependencies installed"

# =============================================================================
# 7. PM2 — start server and enable on boot
# =============================================================================
step 7 "Starting backend server with PM2"
pm2 delete pi-display 2>/dev/null || true
pm2 start "$REPO_DIR/backend/server/server.js" \
  --name pi-display \
  --interpreter node \
  --restart-delay 3000 \
  --max-restarts 10
pm2 save --force > /dev/null

# Attempt to wire up boot startup automatically
STARTUP_OUTPUT=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 || true)
STARTUP_CMD=$(echo "$STARTUP_OUTPUT" | grep "sudo env" | tail -1)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" > /dev/null 2>&1 && ok "PM2 startup registered (survives reboot)" \
    || warn "PM2 startup registration failed — run 'pm2 startup' manually"
else
  warn "Could not auto-register PM2 startup — run 'pm2 startup' and follow the instructions"
fi

# =============================================================================
# 8. Kiosk auto-start
# =============================================================================
step 8 "Configuring kiosk auto-start"

# Make all kiosk scripts executable
chmod +x "$REPO_DIR/ops/stable-kiosk.sh"
chmod +x "$REPO_DIR/ops/simple-kiosk.sh"
chmod +x "$REPO_DIR/ops/start-kiosk.sh"
chmod +x "$REPO_DIR/tests/smoke.sh"

# ~/.xinitrc — what X launches when startx is called
cat > "$HOME/.xinitrc" << XINITRC
#!/bin/bash
exec $REPO_DIR/ops/stable-kiosk.sh
XINITRC
chmod +x "$HOME/.xinitrc"
ok "~/.xinitrc configured"

# ~/.bash_profile — launch X on tty1 console login (idempotent check)
if ! grep -q "pi-smart-display" "$HOME/.bash_profile" 2>/dev/null; then
  cat >> "$HOME/.bash_profile" << 'PROFILE'

# Pi Smart Display — start kiosk on tty1
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx
fi
PROFILE
fi
ok "~/.bash_profile updated"

# Enable console auto-login (B2 = Console Autologin)
sudo raspi-config nonint do_boot_behaviour B2
ok "Console autologin enabled"

# =============================================================================
# Smoke test
# =============================================================================
echo -e "\n${BOLD}Smoke test${NC}"
sleep 2  # give PM2 a moment to fully start the server
if bash "$REPO_DIR/tests/smoke.sh" "http://localhost:8787"; then
  ok "All smoke tests passed"
else
  warn "Smoke tests had failures — check 'pm2 logs pi-display'"
fi

# =============================================================================
# Done
# =============================================================================
LAN_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ════════════════════════════════════════════"
echo "   Installation complete!"
echo "  ════════════════════════════════════════════"
echo -e "${NC}"
echo "  Backend API:  http://localhost:8787"
echo "  Settings UI:  http://${LAN_IP}:8787/settings"
echo ""
echo "  Next steps:"
echo "  1. Open Settings from your phone or laptop:"
echo "     http://${LAN_IP}:8787/settings"
echo "  2. Enter your location, timezone, and calendar URLs"
echo "  3. Reboot:  sudo reboot"
echo ""
echo "  Useful commands:"
echo "    pm2 logs pi-display     — view server logs"
echo "    pm2 restart pi-display  — restart backend"
echo "    bash tests/smoke.sh     — run health checks"
echo ""
