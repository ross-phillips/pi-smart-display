// server/server.js
import express from "express";

const app = express();
// Allow browser requests from http://localhost:5173
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 👇 Add the logger line RIGHT HERE
app.use((req, _res, next) => { 
  console.log(req.method, req.url); 
  next(); 
});

const PORT = process.env.PORT || 8787;

// super-naive in-memory cache
const cache = new Map();
const setCache = (k, v, ttlMs = 5 * 60 * 1000) => cache.set(k, { v, exp: Date.now() + ttlMs });
const getCache = (k) => {
  const c = cache.get(k);
  if (!c) return null;
  if (Date.now() > c.exp) { cache.delete(k); return null; }
  return c.v;
};

function parseICS(text, label = "Calendar") {
  const lines = text.split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) { if (cur) { cur.calendar = label; events.push(cur); cur = null; } }
    else if (cur) {
      if (line.startsWith("SUMMARY:")) cur.title = line.slice(8).trim();
      if (line.startsWith("DTSTART")) {
        const [, val] = line.split(":");
        cur.start = val?.length === 8 ? `${val}T000000` : val;
      }
      if (line.startsWith("DTEND")) {
        const [, val] = line.split(":");
        cur.end = val?.length === 8 ? `${val}T000000` : val;
      }
      if (line.startsWith("LOCATION:")) cur.location = line.slice(9).trim();
    }
  }
  for (const e of events) {
    e.start = toISO(e.start);
    e.end = toISO(e.end);
  }
  return events;
}

function toISO(v) {
  if (!v) return null;
  if (/^\d{8}T\d{6}Z$/.test(v)) return new Date(v).toISOString();
  if (/^\d{8}T\d{6}$/.test(v)) return new Date(v.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6')).toISOString();
  if (/^\d{8}$/.test(v)) return new Date(v.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3T00:00:00')).toISOString();
  return new Date(v).toISOString();
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "PiSmartDisplay/1.0" }});
  if (!r.ok) throw new Error(`Fetch failed ${r.status}`);
  return await r.text();
}

app.get("/api/cal", async (req, res) => {
  try {
    const urlsParam = req.query.u;
    const urls = Array.isArray(urlsParam)
      ? urlsParam
      : String(urlsParam || "").split("&u=").filter(Boolean);

    const key = `cal:${urls.sort().join(',')}`;
    const c = getCache(key); if (c) return res.json(c);

    const out = [];
    for (const raw of urls) {
      const url = decodeURIComponent(raw);
      const txt = await fetchText(url);
      out.push(...parseICS(txt, url));
    }
    setCache(key, out, 2 * 60 * 1000);
    res.json(out);
  } catch (e) {
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
    const urlsParam = req.query.u;
    const urls = Array.isArray(urlsParam)
      ? urlsParam
      : String(urlsParam || "").split("&u=").filter(Boolean);

    const key = `news:${urls.sort().join(',')}`;
    const c = getCache(key); if (c) return res.json(c);

    const out = [];
    for (const raw of urls) {
      const url = decodeURIComponent(raw);
      const xml = await fetchText(url);
      const host = new URL(url).hostname.replace(/^www\./, "");
      out.push(...parseRSS(xml, host));
    }
    out.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    setCache(key, out.slice(0, 50), 2 * 60 * 1000);
    res.json(out.slice(0, 50));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/weather", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error("lat/lon required");

    const key = `wx:${lat},${lon}`;
    const c = getCache(key); if (c) return res.json(c);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&forecast_days=3&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();

    const mapWx = (code) => {
      const m = { 0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 61: "Rain", 71: "Snow", 95: "Thunderstorm" };
      return m[code] || `Code ${code}`;
    };

    const hourly = (j.hourly?.time || []).map((t, i) => ({
      time: t,
      temp: j.hourly?.temperature_2m?.[i],
      code: j.hourly?.weather_code?.[i],
    }));

    const out = {
      city: undefined,
      current: {
        temperature: j.current?.temperature_2m,
        summary: mapWx(j.current?.weather_code),
      },
      hourly,
    };

    setCache(key, out, 5 * 60 * 1000);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Proxy listening on http://0.0.0.0:${PORT}`));
