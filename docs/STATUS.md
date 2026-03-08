# Pi Smart Display — Current Status

_Last updated: March 2026_

---

## ✅ Done

### Backend / Security Sprint
- Git history scrubbed (personal iCloud URLs + GPS coords removed from all 90 commits)
- CORS moved to top of middleware, local-network-only regex
- `requireAuth` admin token guard on `/api/clear-cache`
- `/api/debug-events` endpoint removed
- `fetch.js`: 10s timeout, 5 MB response cap, `AbortController`
- `fetch.js`: `isAllowedResource()` auto-trusts any hostname already in config (calendars, feeds, meals) — no manual allowlist needed
- `validate.js`: `clampNumber`, `safeTz()`, lat/lon/refreshMs clamped
- `server.js`: date format validation on caldays, lat/lon range validation on weather

### Frontend — Bug Fixes
- `Clock` ReferenceError (`apiBase` out of scope) fixed
- `MonthCalendarPanel` positioning fixed
- All caldays + meals fetch handlers guard against non-array responses (`.map()` crash fixed)
- `window.addEventListener('error', ...)` reload loop removed
- News `<a>` links converted to `<span>` (kiosk has no browser chrome)

### Frontend — UI Redesign
- **Font**: Cormorant Garamond replaced with Outfit (geometric, readable at distance)
- **Palette**: Full cream base (`#FAF7F2`), warm peach ambient orbs, muted dusty rose accent only on "today" calendar cell
- **Clock**: Large time left, weekday + date stacked to the right — all on one row
- **Layout**: True 2-column full-height — nothing below the fold, no scrolling required
  - Left column: Clock → Coming Up + News (50/50 row) → Calendar (fills remaining height)
  - Right column: Weather (grows) → Meals (fixed at bottom)
- **Coming Up dates**: Formatted as `Mon 9 Mar` instead of raw `YYYY-MM-DD`
- **Weather icons**: Font Awesome icons replace emoji (consistent rendering on Pi)
- **Panel accent colours**: Sky (weather), Amber (meals), Stone (news/general)
- **Calendar today cell**: Bold `#C07868` highlight — clearly visible
- **Night mode**: Auto-dims to 45% brightness between 22:00–07:00 (no sensor needed)
- **Performance mode**: Defaults to `true` — disables backdrop-filter and animations on Pi
- **Palette switching**: kitchen-pink / clean-neutral / evening-sage CSS classes wired up

### Settings App
- Calendars + feeds: pipe-separated textarea → labeled URL pairs with Add/Remove buttons
- Refresh interval: raw ms input → human-readable select (5/15/30/60 min)
- Preview display link added
- `buildPayload()` auto-populates `allowlist.hosts` from configured URLs
- First-run setup banner when lat = 0
- Admin token inputs use `type="password"`

### install.sh (Pi one-liner installer)
- `sudo apt install -y git && git clone https://github.com/ross-phillips/pi-smart-display.git ~/pi-smart-display && cd ~/pi-smart-display && bash install.sh`
- Adds `xinit` to apt dependencies (provides `startx`)
- Chromium detection uses `apt-cache policy` (works on Bookworm + Trixie)
- Startx block written to `~/.profile` (not `~/.bash_profile`) — correct Debian convention
- Uses `exec startx` so login shell is replaced, not left dangling
- Console autologin via `raspi-config nonint do_boot_behaviour B2`
- `stable-kiosk.sh`: `xrandr --auto` (fixes half-screen), `xset -dpms` (display always on), `vcgencmd display_power 1`, restart loop around Chromium

---

## 🔧 Known Issues / In Progress

| Issue | Status |
|-------|--------|
| News ticker not showing on Pi display | **Investigating** — likely a feeds-not-configured state or visual contrast issue |

---

## 📋 Backlog / Nice-to-have

- CSS `@import` warning from Vite (non-blocking, build succeeds) — already fixed in source, just needs rebuild
- Settings: timezone input could be a searchable dropdown instead of free text
- Weather: add "feels like" temperature
- Calendar: option to show only current week (less dense)
- Dark mode palette (not just dim — full dark colour scheme)
- Font Awesome loaded from CDN — could be self-hosted for offline Pi use
