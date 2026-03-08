# Configuration Review

## Scope Reviewed
- Frontend config: `frontend/package.json`, `frontend/vite.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- Infra: `infra/docker-compose.yml`, `infra/web/Dockerfile`, `backend/server/Dockerfile`
- Ops: `ops/ecosystem.config.js`, `ops/ecosystem.config.cjs`, `ops/*.service`

## Findings
- Frontend scripts now reference `backend/server/server.js`
- Vite dev proxy targets `http://localhost:8787` (server default)
- `docker-compose.yml` still serves the preview build on port `5173`
- systemd services now support env-driven base path and user
- Build artifacts and `node_modules` are ignored via `.gitignore`
- CORS is limited to private network ranges; `x-admin-token` allowed

## Risks
- Running web on 5173 in production can be brittle and may not serve optimized assets
- Settings endpoint uses admin token in headers; ensure token is protected in transit
- iCloud calendars can exceed 1MB; size limits must stay at 5MB

## Recommended Fixes
- Consider serving built assets from a static server for production (Nginx or Node static)
- Add HTTPS termination or local network TLS when exposing settings

## Additional Suggestions
- Keep `data/config.json` backed up for restore
- Add a smoke test script for API and config endpoints
- Prefer Node 20 LTS (per sprint install steps)

## Suggested Next Steps
1. Add static production server image for Docker usage
2. Add optional admin auth middleware for settings UI
