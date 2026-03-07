# Pi Smart Display - Project Overview

## Purpose
Raspberry Pi kiosk-style smart display that shows time/date, weather, news, meals, and a 4-week calendar view.

## Architecture
- Frontend: React + Vite + Tailwind (`src/SmartDisplay.jsx`)
- Backend: Node + Express (`server/server.js`)
- Data sources: Open-Meteo for weather, RSS/Atom for news, ICS calendars for events
- Deployment: PM2 for server process, Chromium kiosk for display

## Key Features
- Fullscreen clock and date header
- Weather current + 7-day forecast
- News feed aggregation (RSS/Atom)
- Meals planner from a weekly ICS
- 4-week calendar grid with bin collection icons
- Kiosk stability safeguards (auto reload, error handling)

## API Endpoints
- `GET /api/weather?lat={lat}&lon={lon}`
- `GET /api/news?u={encodedFeedUrl}&u={encodedFeedUrl}`
- `GET /api/caldays?u={icsUrl}&tz={tz}&start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/meals?u={icsUrl}&tz={tz}`
- `POST /api/clear-cache`

## Frontend Data Flow
- Weather: fetches `/api/weather` on refresh interval
- News: fetches `/api/news` with configured feeds
- Meals: fetches `/api/meals` with a hardcoded ICS URL
- Calendar: fetches `/api/caldays` for primary calendar and bin collection calendar

## Operations and Kiosk
- `deploy-pi.md` documents Pi deployment and kiosk setup
- PM2 config provided via `ecosystem.config.js`
- Kiosk scripts and systemd services included (e.g., `kiosk.sh`, `start-kiosk.sh`, `motion.service`)

## Notable Constraints
- Hardcoded calendar URLs and file paths
- In-memory cache only
- Extensive debug logging in production server
