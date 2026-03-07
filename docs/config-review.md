# Configuration Review

## Scope Reviewed
- Frontend config: `frontend/package.json`, `frontend/vite.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- Infra: `infra/docker-compose.yml`, `infra/web/Dockerfile`, `backend/server/Dockerfile`
- Ops: `ops/ecosystem.config.js`, `ops/ecosystem.config.cjs`, `ops/*.service`

## Findings
- Frontend scripts reference `server/server.js` but the backend now lives in `backend/server`
- Vite dev proxy targets `http://localhost:8787` which matches the server default
- `docker-compose.yml` runs the web container on port `5173` (dev) rather than a built static server
- PM2 configs are duplicated (`.js` and `.cjs`) and hardcode `/home/ross/pi-smart-display`
- systemd services also hardcode `/home/ross/pi-smart-display` and `User=ross`
- Build artifacts and `node_modules` are in the repo and should be excluded from source control

## Risks
- Path changes from the folder restructure will break dev scripts and ops tooling unless updated
- Hardcoded user paths limit portability to other devices
- Running web on 5173 in production can be brittle and may not serve optimized assets

## Recommended Fixes
- Update frontend scripts to reference `backend/server/server.js` or move a backend package.json into root
- Consolidate to a single PM2 config and parameterize paths using env vars
- Update systemd services to use a configurable base path (e.g., `/opt/pi-smart-display`)
- Add `.gitignore` rules for `frontend/dist` and `frontend/node_modules`
- Adjust `docker-compose.yml` to serve built frontend assets (e.g., Nginx or `npm run build` + static server)

## Additional Suggestions
- Introduce a `.env` file for paths, ports, and data source URLs
- Add a `config.json` for non-secret runtime settings (feeds, calendars, location)
- Create a `Makefile` or `npm run setup` to standardize local setup and deployment
- Add a minimal `README.md` to `frontend/` and `backend/` for clarity
- Consider moving ops scripts into `ops/scripts` and services into `ops/systemd`

## Suggested Next Steps (No changes applied)
1. Decide on target deployment path and username conventions
2. Align PM2/systemd configs with the chosen path
3. Update package scripts and docker-compose to match the new folder layout
