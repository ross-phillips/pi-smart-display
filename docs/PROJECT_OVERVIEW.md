# Pi Smart Display - Project Overview

## Purpose
Raspberry Pi kiosk-style smart display that shows time/date, weather, news, meals, and a 4-week calendar view.

## Architecture
- Frontend: React + Vite + Tailwind (`frontend/src/SmartDisplay.jsx`)
- Backend: Node + Express (`backend/server/server.js`)
- Data sources: Open-Meteo for weather, RSS/Atom for news, ICS calendars for events
- Deployment: PM2 + systemd kiosk + Chromium

## Key Features
- Fullscreen clock and date header
- Weather current + 7-day forecast
- News feed aggregation (RSS/Atom)
- Meals planner from a weekly ICS
- 4-week calendar grid with bin collection icons
- Kiosk stability safeguards (auto reload, error handling)

## API Endpoints
- `GET /api/weather?lat={lat}&lon={lon}`
- `GET /api/news?u={encodedFeedUrl}&u={encodedFeedUrl}` (optional; defaults to configured feeds)
- `GET /api/caldays?u={icsUrl}&u={icsUrl}&tz={tz}&start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/meals?u={icsUrl}&tz={tz}`
- `GET /api/config`
- `POST /api/config`
- `GET /api/health`
- `POST /api/clear-cache`

## Frontend Data Flow
- Weather: fetches `/api/weather` on refresh interval (config-driven)
- News: fetches `/api/news` with configured feeds
- Meals: fetches `/api/meals` with configured meals calendar
- Calendar: fetches `/api/caldays` for multiple calendars and optional bin calendar
- Settings: reads/writes `/api/config`

## Operations and Kiosk
- `docs/SPRINT_SECURITY_AND_PI_DEPLOY.md` details hardening and Pi deployment
- `docs/install-pi.md` documents Pi deployment and kiosk setup
- PM2 manages the backend service
- systemd kiosk units and scripts included in `ops/`

## Notable Constraints
- External feeds require connectivity; large iCloud calendars may be multi‑MB
- Calendar feeds must be allowlisted (configured URLs are auto‑trusted)
