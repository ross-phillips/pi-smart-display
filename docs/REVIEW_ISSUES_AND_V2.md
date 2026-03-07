# Pi Smart Display - Review, Issues, and V2 Recommendations

## Current State Summary
- React kiosk UI renders clock, weather, news, meals, and a 4-week calendar grid
- Express API provides weather, RSS aggregation, and ICS parsing/expansion
- Raspberry Pi deployment documented with PM2 and Chromium kiosk
- Feedback: V1 was functional but felt boring

## Issues and Recommended Fixes
- Hardcoded data sources: move calendar and feed URLs to config or env vars and add UI settings panel
- Local file path dependency for bin calendar (`/home/ross/bin_collection.ics`): provide upload UI or configurable path
- Excessive debug logging in `server/server.js`: gate logs behind a debug flag and default to quiet
- Mixed concerns in `server/server.js`: split into modules (calendar, news, weather) for maintainability
- No persistence layer: add simple JSON/SQLite storage for settings and last-known data
- Lack of health checks: add `/api/health` and basic uptime status
- Error handling UI is minimal: add user-facing fallbacks per panel with last-updated timestamps
- Security: add basic URL allowlist for RSS/ICS to avoid arbitrary fetches
- Build artifacts in repo (`dist/`): ensure build output is ignored and generated in CI
- CSS/visual direction relies on a single dark gradient: create a design system with a more engaging visual identity

## V2 Recommendations (Addressing “Boring but Functional” Feedback)
- Visual identity: introduce a strong theme (e.g., warm studio, calm morning, or modern transit board) with distinct typography
- Motion: add purposeful transitions between panels and subtle data refresh animations
- Content richness: add daily highlights and “next up” prompts to make the display feel alive
- Personalization: allow multiple display modes (focus, family, office) and quick scene switching
- Ambient visuals: add background gradients or time-of-day visuals that shift over the day
- Context awareness: show “right now” cards (current event, next appointment, weather change)
- Layout variation: add alternate layouts that rotate on a schedule to reduce monotony
- Optional widgets: add commute time, reminders, or goal progress to increase engagement
- Sound cues (optional): minimal alerts for key events or time blocks
