# Security Sprint & Pi Deployment — Change Log

## Overview

This document covers the security/stability sprint and the full Raspberry Pi deployment work carried out in March 2026.

---

## 1. Git History Scrub

**Problem:** Personal iCloud calendar URLs and GPS coordinates (lat/lon) were hardcoded in committed source files across 90 commits of git history.

**Fix:** Used `git filter-repo` with a replacements file to rewrite every commit, replacing the sensitive strings with empty values. Force-pushed the rewritten history to GitHub.

> **Note:** `git filter-repo` resets the working tree to match rewritten HEAD — all uncommitted sprint changes were lost and had to be re-applied from scratch.

---

## 2. Security Fixes (Backend)

### `backend/server/lib/config.js`
- Removed personal iCloud calendar URLs from `DEFAULT_CONFIG`
- Removed `p46-caldav.icloud.com` from default allowlist hosts
- Changed `label` default from `"Kitchen"` to `""`
- Removed hardcoded "Family Calendar" entry

### `backend/server/lib/validate.js`
- `clampNumber` updated to 4-arg form: `(value, min, max, fallback)`
- Added `safeTz()` using `Intl.DateTimeFormat` for timezone validation
- Lat clamped to `-90…90`, lon to `-180…180`
- `refreshMs` clamped to `60,000…86,400,000 ms`

### `backend/server/lib/fetch.js`
- Added `FETCH_TIMEOUT_MS = 10,000` with `AbortController`
- Added `MAX_RESPONSE_BYTES = 5,242,880` (5 MB) size cap
  - Originally 1 MB, raised to 5 MB because iCloud calendars store full event history and routinely exceed 1 MB
- Added `configuredHosts()` helper — automatically trusts any hostname already present in `config.calendars`, `config.feeds`, or `config.mealsCalendar.url`
- `isAllowedResource()` now accepts configured source URLs without needing them manually added to `allowlist.hosts`

### `backend/server/server.js`
- CORS moved to top of middleware chain (was incorrectly placed after route handlers)
- `Access-Control-Allow-Origin: *` replaced with local-network-only regex (`PRIVATE_IP_RE`)
- Added `x-admin-token` to CORS allowed headers
- Added `requireAuth` helper for admin token checking
- Added `isValidDate` helper for `YYYY-MM-DD` format validation
- `/api/clear-cache` now requires auth token
- `/api/caldays` validates date format before processing
- `/api/weather` validates lat/lon ranges
- `/api/debug-events` endpoint removed entirely

---

## 3. Security Fixes (Frontend)

### `frontend/src/SmartDisplay.jsx`
- Removed `ReferenceError` in `Clock` component (`apiBase` out of scope)
- Fixed `MonthCalendarPanel` positioning (`fixed` → `mt-6`)
- Moved `useState` declarations above function that referenced them
- Added `useMemo` stable keys for `feeds` and `calendars` props to prevent unnecessary re-fetches
- Removed `window.addEventListener('error', handleError)` reload loop
- Converted news `<a>` links to `<span>` (kiosk has no browser chrome)
- Replaced `'NO TITLE'` placeholder with styled dash element
- Abbreviated week labels to `Mon/Tue/Wed/Thu/Fri/Sat/Sun`
- **All caldays fetch handlers** (`ContextHighlights`, `MonthCalendarPanel` main + bin): added `r.ok` check before parsing JSON and `Array.isArray` guard so a 500/403 response shows as an error state instead of crashing `.map()` / `for...of`
- **MealsPanel**: same `r.ok` + `Array.isArray` guard added

### `frontend/src/SettingsApp.jsx`
- Added `useEffect(() => setDraft(config), [config])` for draft sync
- Added Location Label field
- Added first-run setup banner when `lat === 0`
- Admin token inputs changed to `type="password"`
- `Toggle` now has `role="switch"`, `aria-checked`, `aria-label`
- Added "No admin token set" amber warning
- Added `buildPayload()` that auto-populates `allowlist.hosts` from all configured URLs
- Centralised `inputCls` constant for consistent input styling

---

## 4. Kiosk Scripts

### `ops/stable-kiosk.sh`
- Fixed URL: `localhost:5173` (Vite dev server) → `localhost:8787` (production backend)
- Fixed `XDG_RUNTIME_DIR`: hardcoded `/run/user/1000` → `${XDG_RUNTIME_DIR:-/run/user/$(id -u)}`
- Added `xset -dpms`, `xset s off`, `xset s noblank` — display stays on without a motion sensor
- Added `vcgencmd display_power 1` — forces HDMI on at kiosk start
- Added `xrandr --auto` — auto-detects correct display resolution (fixes half-screen issue)
- Removed `--disable-software-rasterizer` flag — combining it with `--disable-gpu` left Chromium with no render backend, causing immediate crash
- Added `while true; do ... sleep 2; done` restart loop — Chromium relaunches if it ever exits
- Removed `--disable-web-security` flag (security)

### `ops/simple-kiosk.sh`, `ops/start-kiosk.sh`
- Removed `--disable-web-security` flag
- Fixed `XDG_RUNTIME_DIR` hardcoding
- Fixed URL (`localhost:3000` → `localhost:8787`)

---

## 5. Install Script (`install.sh`)

Single-command Pi setup:
```bash
sudo apt install -y git && git clone https://github.com/ross-phillips/pi-smart-display.git ~/pi-smart-display && cd ~/pi-smart-display && bash install.sh
```

### What the installer does (8 steps):
| Step | Action |
|------|--------|
| 0 | Bootstrap `git` if not present |
| 1 | `apt-get update && full-upgrade` |
| 2 | Install Node.js 20 LTS via NodeSource |
| 3 | Install `xserver-xorg`, `xinit`, `x11-xserver-utils`, `unclutter`, Chromium |
| 4 | Install PM2 globally |
| 5 | `npm install` + `npm run build` frontend |
| 6 | `npm install` backend |
| 7 | Start backend with PM2, register PM2 startup service |
| 8 | Write `~/.xinitrc`, write startx block to `~/.profile`, enable console autologin via `raspi-config` |

### Key fixes during Pi deployment:
| Error | Root cause | Fix |
|-------|-----------|-----|
| `git: command not found` | Fresh RPi OS Lite has no git | Added git bootstrap step + updated one-liner |
| `chromium-browser has no installation candidate` | Used `apt-cache show` which exits 0 even with no candidate | Switched to `apt-cache policy \| grep Candidate \| grep -v "(none)"` |
| GitHub auth rejected | GitHub dropped password auth in 2021 | Made repo public |
| `startx: command not found` | `xinit` not in apt install list | Added `xinit` to step 3 |
| X didn't start on boot | Startx block written to `~/.bash_profile`; bash reads that file and skips `~/.profile` where system PATH lives | Moved block to `~/.profile` (correct Debian convention); changed `startx` to `exec startx` |
| Half screen / blank after load | `--disable-gpu` + `--disable-software-rasterizer` = no render backend → Chromium crash; display resolution not detected | Removed `--disable-software-rasterizer`; added `xrandr --auto`; added restart loop |
| 403 on caldays/meals | iCloud hostname not in `allowlist.hosts` | `isAllowedResource()` now auto-trusts configured source URLs |
| 500 on caldays/meals | Calendar response > 1 MB size cap | Raised cap to 5 MB |

---

## 6. Other

- `frontend/package.json`: removed `express` from frontend dependencies (it's a backend concern)
- `backend/server/.env.example`: documented `ADMIN_TOKEN` with `openssl rand -hex 32` suggestion
- `tests/smoke.sh`: verified present and executable; runs against `http://localhost:8787`

---

## Pi Hardware Setup

- **Device:** Raspberry Pi (kitchendisplay / `ross@kitchendisplay.local`)
- **OS:** Raspberry Pi OS Lite (64-bit) — no desktop environment
- **Boot:** Console autologin → `~/.profile` → `exec startx` → `~/.xinitrc` → `stable-kiosk.sh` → Chromium kiosk
- **Backend:** Node.js served by PM2, survives reboots via systemd
- **Display:** Always-on (DPMS disabled), HDMI forced on at kiosk start
