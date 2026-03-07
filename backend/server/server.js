import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createCache } from "./lib/cache.js";
import { loadConfig, saveConfig, sanitizeConfig } from "./lib/config.js";
import { normalizeConfig } from "./lib/validate.js";
import { fetchText, isAllowedResource } from "./lib/fetch.js";
import { parseICS, toISO, expandEvents, mapEventsToDays } from "./lib/ics.js";
import { createLogger } from "./lib/logger.js";
import { getDataDir, readJson, writeJson } from "./lib/storage.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
const configState = { value: loadConfig() };
const log = createLogger(process.env.DEBUG_LOGS === "true");
const dataDir = getDataDir();
const snapshotPath = path.join(dataDir, "snapshot.json");
// Meals: minimal weekly-recurring expansion for next 14 days
app.get("/api/meals", async (req, res) => {
  try {
    const cfg = configState.value;
    const icsUrl = String(req.query.u || cfg.mealsCalendar?.url || "");
    const tz = String(req.query.tz || cfg.location?.tz || "Europe/London");
    if (!icsUrl) return res.status(400).json({ error: "meals calendar not configured" });
    const key = `meals:v2:${icsUrl}:${tz}`;
    const c = cache.get(key); if (c) return res.json(c);
    const txt = await fetchText(icsUrl, cfg);
    const events = parseICS(txt, icsUrl);
    const now = new Date();
    const monday = new Date(now);
    const dow = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const windowStart = new Date(monday);
    const windowEnd = new Date(monday);
    windowEnd.setDate(monday.getDate() + 6);
    const expanded = expandEvents(events, windowStart, windowEnd);
    const days = mapEventsToDays(expanded, windowStart, windowEnd, tz);
    const out = days.map((d) => ({ day: d.day, title: d.titles?.[0]?.title ?? null }));
    cache.set(key, out, 2 * 60 * 1000);
    const snapshot = readJson(snapshotPath, {});
    writeJson(snapshotPath, { ...snapshot, meals: out, updatedAt: new Date().toISOString() });
    res.json(out);
  } catch (e) {
    const snapshot = readJson(snapshotPath, {});
    if (snapshot.meals) return res.json(snapshot.meals);
    res.status(500).json({ error: String(e) });
  }
});
// Allow browser requests from http://localhost:5173
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use((req, _res, next) => {
  log.info(req.method, req.url);
  next();
});

const PORT = process.env.PORT || 8787;

// Resolve project root and dist path (server runs from backend/server)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const distDir = path.join(projectRoot, "frontend", "dist");
const hasBuiltFrontend = fs.existsSync(path.join(distDir, "index.html"));

// Serve built frontend if it exists
if (hasBuiltFrontend) {
  app.use(express.static(distDir));
}

const cache = createCache();

const configResponse = () => sanitizeConfig(configState.value);

// Calendar endpoints removed per request
// Lightweight per-day calendar aggregation for a single ICS

// Clear cache endpoint
app.post("/api/clear-cache", (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared" });
});

// Debug endpoint to test date range filtering
app.get("/api/config", (req, res) => {
  res.json(configResponse());
});

app.post("/api/config", (req, res) => {
  try {
    const token = String(req.headers["x-admin-token"] || "");
    const required = configState.value.adminToken;
    if (required && token !== required) {
      return res.status(403).json({ error: "unauthorized" });
    }
    const next = saveConfig(normalizeConfig(req.body || {}));
    configState.value = next;
    cache.clear();
    res.json(configResponse());
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/caldays", async (req, res) => {
  try {
    let icsUrl = String(req.query.u || "");
    const tz = String(req.query.tz || configState.value.location?.tz || "Europe/London");
    const start = String(req.query.start || ""); // YYYY-MM-DD
    const end = String(req.query.end || "");   // YYYY-MM-DD
    if (!icsUrl || !start || !end) return res.status(400).json({ error: "u,start,end required" });
    const cfg = configState.value;
    if (!isAllowedResource(icsUrl, cfg)) {
      return res.status(403).json({ error: "calendar source not allowed" });
    }
    const key = `caldays:v2:${icsUrl}:${tz}:${start}:${end}`;
    const c = cache.get(key); if (c) return res.json(c);
    const txt = await fetchText(icsUrl, cfg);
    const events = parseICS(txt, icsUrl);
    const windowStart = new Date(`${start}T00:00:00Z`);
    const windowEnd = new Date(`${end}T23:59:59Z`);
    const expanded = expandEvents(events, windowStart, windowEnd);
    const out = mapEventsToDays(expanded, windowStart, windowEnd, tz);
    cache.set(key, out, 2 * 60 * 1000);
    const snapshot = readJson(snapshotPath, {});
    writeJson(snapshotPath, { ...snapshot, calendar: out, updatedAt: new Date().toISOString() });
    res.json(out);
  } catch (e) {
    const snapshot = readJson(snapshotPath, {});
    if (snapshot.calendar) return res.json(snapshot.calendar);
    res.status(500).json({ error: String(e) });
  }
});

function parseRSS(xml, sourceName) {
  const items = [];
  const get = (re, s) => (s.match(re)?.[1] || "").trim();
  const entryRe = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  const titleRe = /<title>([\s\S]*?)<\/title>/i;
  const linkRe = /<link[^>]*>([\s\S]*?)<\/link>|<link[^>]*href=\"([^\"]+)\"[^>]*\/>/i;
  const dateRe = /<pubDate>([\s\S]*?)<\/pubDate>|<updated>([\s\S]*?)<\/updated>/i;

  const entries = xml.match(entryRe) || [];
  for (const e of entries) {
    const title = get(titleRe, e).replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
    let link = "";
    const lm = e.match(linkRe);
    if (lm) link = (lm[1] || lm[2] || "").replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
    const pubDate = get(dateRe, e);
    if (title) items.push({ title, link, pubDate, source: sourceName });
  }
  return items;
}

app.get("/api/news", async (req, res) => {
  try {
    const cfg = configState.value;
    const urlsParam = req.query.u;
    const urls = Array.isArray(urlsParam)
      ? urlsParam
      : String(urlsParam || "").split("&u=").filter(Boolean);

    const feedUrls = urls.length ? urls : (cfg.feeds || []).map((feed) => feed.url);
    const key = `news:${feedUrls.sort().join(',')}`;
    const c = cache.get(key); if (c) return res.json(c);

    const out = [];
    for (const raw of feedUrls) {
      const url = decodeURIComponent(raw);
      if (!isAllowedResource(url, cfg)) {
        continue;
      }
      const xml = await fetchText(url, cfg);
      const host = new URL(url).hostname.replace(/^www\./, "");
      out.push(...parseRSS(xml, host));
    }
    out.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    const payload = out.slice(0, 50);
    cache.set(key, payload, 2 * 60 * 1000);
    const snapshot = readJson(snapshotPath, {});
    writeJson(snapshotPath, { ...snapshot, news: payload, updatedAt: new Date().toISOString() });
    res.json(payload);
  } catch (e) {
    const snapshot = readJson(snapshotPath, {});
    if (snapshot.news) return res.json(snapshot.news);
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const cfg = configState.value;
    const lat = Number(req.query.lat ?? cfg.location?.lat);
    const lon = Number(req.query.lon ?? cfg.location?.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error("lat/lon required");

    // bump version to invalidate old cached shape/units
    const key = `wx:v2:${lat},${lon}`;
    const c = cache.get(key); if (c) return res.json(c);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&forecast_days=7&timezone=auto&wind_speed_unit=mph`;
    const r = await fetch(url);
    const j = await r.json();

    const mapWx = (code) => {
      const m = {
        0: "Clear",
        1: "Mostly Clear",
        2: "Partly Cloudy",
        3: "Cloudy",
        45: "Fog",
        48: "Freezing Fog",
        51: "Light Drizzle",
        53: "Drizzle",
        55: "Heavy Drizzle",
        56: "Light Freezing Drizzle",
        57: "Freezing Drizzle",
        61: "Light Rain",
        63: "Rain",
        65: "Heavy Rain",
        66: "Light Freezing Rain",
        67: "Freezing Rain",
        71: "Light Snow",
        73: "Snow",
        75: "Heavy Snow",
        77: "Snow Grains",
        80: "Light Rain Shower",
        81: "Rain Shower",
        82: "Heavy Rain Shower",
        85: "Snow Shower",
        86: "Heavy Snow Shower",
        95: "Thunderstorm",
        96: "Hailstorm",
        99: "Heavy Hailstorm",
      };
      if (code == null) return "";
      return m[code] || `Code ${code}`;
    };

    const hourly = (j.hourly?.time || []).map((t, i) => ({
      time: t,
      temp: j.hourly?.temperature_2m?.[i],
      code: j.hourly?.weather_code?.[i],
      windSpeed: j.hourly?.wind_speed_10m?.[i],
      windDir: j.hourly?.wind_direction_10m?.[i],
    }));

    const daily = (j.daily?.time || []).map((d, i) => ({
      date: d,
      tmax: j.daily?.temperature_2m_max?.[i],
      tmin: j.daily?.temperature_2m_min?.[i],
      code: j.daily?.weather_code?.[i],
      windSpeed: j.daily?.wind_speed_10m_max?.[i],
      windDir: j.daily?.wind_direction_10m_dominant?.[i],
    }));

    const out = {
      city: cfg.location?.label,
      current: {
        temperature: j.current?.temperature_2m,
        summary: mapWx(j.current?.weather_code),
        code: j.current?.weather_code,
      },
      hourly,
      daily,
    };

    cache.set(key, out, 5 * 60 * 1000);
    const snapshot = readJson(snapshotPath, {});
    writeJson(snapshotPath, { ...snapshot, weather: out, updatedAt: new Date().toISOString() });
    res.json(out);
  } catch (e) {
    const snapshot = readJson(snapshotPath, {});
    if (snapshot.weather) return res.json(snapshot.weather);
    res.status(500).json({ error: String(e) });
  }
});

// Meals: tz-aware 7-day bucketing from a single ICS URL
// Meals endpoint removed per request

// SPA fallback for non-API routes to support client-side routing
app.get(/^(?!\/api\/).*$/, (req, res, next) => {
  if (req.method !== "GET") return next();
  if (hasBuiltFrontend) {
    return res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next();
    });
  }
  // No built frontend available – guide the developer
  res.status(200).send(
    "Frontend not built. Use http://localhost:5173 during development (npm run dev) or run 'npm run serve' to build and serve production."
  );
});

// Debug endpoint to see raw parsed events
app.get("/api/debug-events", async (req, res) => {
  try {
    const cfg = configState.value;
    const icsUrl = String(req.query.u || "");
    if (!icsUrl) return res.status(400).json({ error: "u required" });
    const txt = await fetchText(icsUrl, cfg);
    const events = parseICS(txt, icsUrl);
    res.json({ total: events.length, events });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://0.0.0.0:${PORT}`));
