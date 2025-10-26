import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
// Meals: minimal weekly-recurring expansion for next 14 days
app.get("/api/meals", async (req, res) => {
  try {
    let icsUrl = String(req.query.u || "");
    const tz = String(req.query.tz || "Europe/London");
    if (!icsUrl) return res.status(400).json({ error: "u required" });
    icsUrl = decodeURIComponent(icsUrl).replace(/^webcal:\/\//i, 'https://');

    const key = `meals:v1:${icsUrl}:${tz}`;
    const c = getCache(key); if (c) return res.json(c);

    const txt = await fetchText(icsUrl);
    const lines = txt.split(/\r?\n/);
    const evts = [];
    let cur = null;
    for (const line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) cur = {};
      else if (line.startsWith("END:VEVENT")) { if (cur) { evts.push(cur); cur = null; } }
      else if (cur) {
        if (line.startsWith("SUMMARY:")) cur.title = line.slice(8).trim();
        if (line.startsWith("DTSTART")) { 
          const colonIndex = line.indexOf(":");
          const v = colonIndex >= 0 ? line.slice(colonIndex + 1) : "";
          cur.start = v?.length===8? `${v}T000000` : v; 
        }
        if (line.startsWith("DTEND")) { 
          const colonIndex = line.indexOf(":");
          const v = colonIndex >= 0 ? line.slice(colonIndex + 1) : "";
          cur.end = v?.length===8? `${v}T000000` : v; 
        }
        if (line.startsWith("RRULE:")) cur.rrule = line.slice(6).trim();
      }
    }
    console.log(`DEBUG: Parsed ${evts.length} events from ICS`);
    console.log(`DEBUG: First few events:`, evts.slice(0, 3));
    console.log(`DEBUG: Looking for Sports Massage event:`, evts.filter(e => e.title && e.title.includes('Sports Massage')));
    console.log(`DEBUG: All events with 'Massage' in title:`, evts.filter(e => e.title && e.title.includes('Massage')));
    console.log(`DEBUG: All events on 2025-10-29:`, evts.filter(e => e.start && e.start.includes('2025-10-29')));
    for (const e of evts) { e.start = toISO(e.start); e.end = toISO(e.end); }

        const start = new Date();
        // Calculate Monday-Sunday of current week for recurring events
        const monday = new Date(start);
        const dow = (start.getDay() + 6) % 7; // 0 = Monday
        monday.setDate(start.getDate() - dow);
        monday.setHours(0, 0, 0, 0);
        
        const windowStart = new Date(monday);
        const windowEnd = new Date(monday);
        windowEnd.setDate(monday.getDate() + 6); // Sunday of current week
    const idxToWd = ["SU","MO","TU","WE","TH","FR","SA"];

    console.log(`DEBUG: Window start: ${windowStart.toISOString()}, end: ${windowEnd.toISOString()}`);
    console.log(`DEBUG: Current date: ${start.toISOString()}`);

    const expanded = [];
    for (const e of evts) {
      if (e.rrule && /FREQ=WEEKLY/.test(e.rrule)) {
        console.log(`DEBUG: Processing recurring event "${e.title}" with RRULE: ${e.rrule}`);
        const interval = parseInt((e.rrule.match(/INTERVAL=(\d+)/)?.[1]||'1'),10);
        const bydays = (e.rrule.match(/BYDAY=([A-Z,]+)/)?.[1] || idxToWd[new Date(e.start).getDay()]).split(',');
        console.log(`DEBUG: Recurring event "${e.title}" - interval: ${interval}, bydays: ${bydays}, start: ${e.start}`);
        for (let d = new Date(windowStart); d < windowEnd; d.setDate(d.getDate()+1)) {
          const wd = idxToWd[d.getDay()];
          if (!bydays.includes(wd)) continue;
          const weeks = Math.floor((d - new Date(e.start)) / (7*24*60*60*1000));
          if (weeks < 0 || weeks % interval !== 0) continue;
          const occStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0);
          const dayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(occStart);
          console.log(`DEBUG: Adding recurring "${e.title}" for ${dayStr} (week ${weeks})`);
          expanded.push({ day: dayStr, title: e.title });
        }
      } else {
        const eventStart = new Date(e.start);
        const eventEnd = new Date(e.end || e.start);
        console.log(`DEBUG: Event "${e.title}" start: ${eventStart.toISOString()}, end: ${eventEnd.toISOString()}`);
        if (eventEnd >= windowStart && eventStart <= windowEnd) {
          const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(eventStart);
          expanded.push({ day, title: e.title });
          console.log(`DEBUG: Added event "${e.title}" for day ${day}`);
        }
      }
    }
    console.log(`DEBUG: Expanded events: ${expanded.length}`);

    // Pick first per day for next 7 days
    const toYmd = (d) => {
      const date = new Date(d);
      // Use toLocaleDateString with timezone to get proper local date
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const perDay = new Map();
    for (const e of expanded.sort((a,b)=> a.day.localeCompare(b.day))) {
      // Convert the day format to YYYY-MM-DD using timezone-aware formatting
      const isoDay = toYmd(new Date(e.day));
      if (!perDay.has(isoDay)) perDay.set(isoDay, e);
    }
    console.log(`DEBUG: perDay map:`, Array.from(perDay.entries()).slice(0, 5));
    
        // Generate Monday-Sunday of current week instead of today+6 days
        const out = [];
        const now = new Date();
        const mondayForOutput = new Date(now);
        const dowForOutput = (now.getDay() + 6) % 7; // 0 = Monday
        mondayForOutput.setDate(now.getDate() - dowForOutput);
        mondayForOutput.setHours(0, 0, 0, 0);
        
        for (let i=0;i<7;i++) {
          const d = new Date(mondayForOutput);
          d.setDate(mondayForOutput.getDate() + i);
          const k = toYmd(d);
          console.log(`DEBUG: Date object: ${d.toISOString()}, Formatted: ${k}`);
          const event = perDay.get(k);
          console.log(`DEBUG: Day ${i}: ${k} -> ${event ? event.title : 'null'}`);
          out.push(event ? { day: k, title: event.title } : { day: k, title: null });
        }
    console.log(`DEBUG: Final output:`, out);

    setCache(key, out, 2*60*1000);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
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

// Resolve project root and dist path (server runs from server/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const hasBuiltFrontend = fs.existsSync(path.join(distDir, "index.html"));

// Serve built frontend if it exists
if (hasBuiltFrontend) {
  app.use(express.static(distDir));
}

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
  console.log(`DEBUG: parseICS called with label: ${label}`);
  const lines = text.split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) { if (cur) { cur.calendar = label; events.push(cur); cur = null; } }
    else if (cur) {
      if (line.startsWith("SUMMARY:")) cur.title = line.slice(8).trim();
      if (line.startsWith("DTSTART")) {
        const [prop, valRaw] = line.split(":");
        const val = valRaw;
        if (/VALUE=DATE/i.test(prop) || (val && val.length === 8)) cur.allDay = true;
        cur.start = val?.length === 8 ? `${val}T000000` : val;
      }
      if (line.startsWith("DTEND")) {
        const [prop, valRaw] = line.split(":");
        const val = valRaw;
        if (/VALUE=DATE/i.test(prop) || (val && val.length === 8)) cur.endIsDate = true; // likely exclusive end
        cur.end = val?.length === 8 ? `${val}T000000` : val;
      }
      if (line.startsWith("RRULE:")) cur.rrule = line.slice(6).trim();
      if (line.startsWith("EXDATE")) {
        const [, valRaw] = line.split(":");
        const vals = String(valRaw || "").split(",").map(v => v.trim()).filter(Boolean);
        cur.exdates = [...(cur.exdates || []), ...vals];
      }
      if (line.startsWith("LOCATION:")) cur.location = line.slice(9).trim();
    }
  }
  const out = [];
  for (const e of events) {
    const s = toISO(e.start);
    const en = toISO(e.end);
    if (!s) continue;
    out.push({ ...e, start: s, end: en });
  }
  console.log(`DEBUG: parseICS returning ${out.length} events`);
  console.log(`DEBUG: parseICS Sports Massage events:`, out.filter(e => e.title && e.title.includes('Sports Massage')));
  return out;
}

function toISO(v) {
  if (!v) return null;
  try {
    if (/^\d{8}T\d{6}Z$/.test(v)) {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]));
      return d.toISOString();
    }
    if (/^\d{8}T\d{6}$/.test(v)) {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
      const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]));
      return d.toISOString();
    }
    if (/^\d{8}$/.test(v)) {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
      const d = new Date(+m[1], +m[2]-1, +m[3], 0, 0, 0);
      return isNaN(d) ? null : d.toISOString();
    }
    const afterColon = v.includes(":") ? v.split(":").pop() : v;
    const d = new Date(afterColon);
    return isNaN(d) ? null : d.toISOString();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "PiSmartDisplay/1.0" }});
  if (!r.ok) throw new Error(`Fetch failed ${r.status}`);
  return await r.text();
}

// Calendar endpoints removed per request
// Lightweight per-day calendar aggregation for a single ICS

// Helper function to detect if we're in BST (British Summer Time)
function isBST(date = new Date()) {
  const year = date.getFullYear();
  // BST starts last Sunday in March, ends last Sunday in October
  const marchLastSunday = new Date(year, 2, 31 - new Date(year, 2, 31).getDay());
  const octoberLastSunday = new Date(year, 9, 31 - new Date(year, 9, 31).getDay());
  return date >= marchLastSunday && date < octoberLastSunday;
}

// Get proper timezone offset for UK
function getUKTimezoneOffset() {
  return isBST() ? '+01:00' : '+00:00'; // BST is UTC+1, GMT is UTC+0
}

// Clear cache endpoint
app.post("/api/clear-cache", (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared" });
});

// Debug endpoint to test date range filtering
app.get("/api/debug-date-range", async (req, res) => {
  try {
    const start = "2025-10-29";
    const end = "2025-10-29";
    const windowStart = new Date(`${start}T00:00:00Z`);
    const windowEnd = new Date(`${end}T23:59:59Z`);
    
    const sportsMassageStart = new Date("2025-10-29T10:00:00.000Z");
    const sportsMassageEnd = new Date("2025-10-29T10:45:00.000Z");
    
    const isInRange = !(sportsMassageEnd < windowStart || sportsMassageStart > windowEnd);
    
    res.json({
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      sportsMassageStart: sportsMassageStart.toISOString(),
      sportsMassageEnd: sportsMassageEnd.toISOString(),
      isInRange,
      currentTime: new Date().toISOString(),
      isBST: isBST()
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/caldays", async (req, res) => {
  try {
    console.log(`DEBUG: caldays endpoint called with URL: ${req.query.u}`);
    let icsUrl = String(req.query.u || "");
    const tz = String(req.query.tz || "Europe/London");
    const start = String(req.query.start || ""); // YYYY-MM-DD
    const end = String(req.query.end || "");   // YYYY-MM-DD
    if (!icsUrl || !start || !end) return res.status(400).json({ error: "u,start,end required" });
    
    console.log(`DEBUG: caldays processing - icsUrl: ${icsUrl}, start: ${start}, end: ${end}`);
    
    // Handle local file path
    if (icsUrl.startsWith('/home/')) {
      const fs = await import('fs');
      const txt = fs.readFileSync(icsUrl, 'utf8');
      const events = parseICS(txt, icsUrl);
      
      const windowStart = new Date(`${start}T00:00:00Z`);
      const windowEnd = new Date(`${end}T23:59:59Z`);
      const pad = (n) => String(n).padStart(2, '0');
      const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

      const days = new Map();
      const allKeys = [];
      for (let d = new Date(windowStart.getTime()); d <= windowEnd; d.setDate(d.getDate()+1)) {
        const k = toYmd(d);
        allKeys.push(k);
        days.set(k, []);
      }

      for (const e of events) {
        if (e.title && e.title.includes('Sports Massage')) {
          console.log(`DEBUG: Processing Sports Massage event - start: ${e.start}, end: ${e.end}, title: ${e.title}`);
        }
        const es = new Date(e.start);
        let ee = new Date(e.end || e.start);
        
        // Special handling for Sports Massage event to ensure it's included
        if (e.title && e.title.includes('Sports Massage')) {
          console.log(`DEBUG: Sports Massage event dates - es: ${es.toISOString()}, ee: ${ee.toISOString()}`);
        }
        
        if (e.allDay) {
          if (e.endIsDate && e.end) {
            ee = new Date(ee.getFullYear(), ee.getMonth(), ee.getDate(), ee.getHours(), ee.getMinutes(), ee.getSeconds());
            ee.setDate(ee.getDate() - 1);
          } else if (!e.end) {
            ee = new Date(es);
          }
        }

        if (ee < windowStart || es > windowEnd) {
          if (e.title && e.title.includes('Sports Massage')) {
            console.log(`DEBUG: Sports Massage event filtered out - start: ${es.toISOString()}, end: ${ee.toISOString()}, window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
          }
          console.log(`DEBUG: Filtering out event "${e.title}" - start: ${es.toISOString()}, end: ${ee.toISOString()}, window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
          continue;
        }

        const d0 = new Date(Math.max(es.getTime(), windowStart.getTime()));
        d0.setHours(0,0,0,0);
        const endDay = new Date(Math.min(ee.getTime(), windowEnd.getTime()));
        endDay.setHours(0,0,0,0);

        for (let d = new Date(d0); d <= endDay; d.setDate(d.getDate()+1)) {
          const k = toYmd(d);
          const arr = days.get(k) || [];
          let time = null;
          if (!e.allDay) {
            const startKey = toYmd(es);
            if (startKey === k) {
              try {
                time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(es);
              } catch {
                time = null;
              }
            }
          }
          if (e.title && e.title.includes('Sports Massage')) {
            console.log(`DEBUG: Adding Sports Massage event to day ${k} with time ${time}`);
          }
          arr.push({ title: e.title, allDay: !!e.allDay, time });
          days.set(k, arr);
        }
      }

      const out = allKeys.map((k) => {
        const dayEvents = days.get(k) || [];
        if (k === '2025-10-29') {
          console.log(`DEBUG: Events for ${k}:`, dayEvents);
        }
        const sorted = dayEvents.sort((a, b) => {
          if (a.allDay && !b.allDay) return -1;
          if (!a.allDay && b.allDay) return 1;
          if (!a.allDay && !b.allDay) {
            const timeA = a.time || '23:59';
            const timeB = b.time || '23:59';
            return timeA.localeCompare(timeB);
          }
          return 0;
        });
        if (k === '2025-10-29') {
          console.log(`DEBUG: Sorted events for ${k}:`, sorted);
        }
        return { day: k, titles: sorted };
      });
      
      return res.json(out);
    }
    
    icsUrl = decodeURIComponent(icsUrl).replace(/^webcal:\/\//i, 'https://');
    console.log(`DEBUG: caldays remote URL processing - converted URL: ${icsUrl}`);

    const key = `caldays:v1:${icsUrl}:${tz}:${start}:${end}`;
    const c = getCache(key); if (c) return res.json(c);

    const txt = await fetchText(icsUrl);
    console.log(`DEBUG: caldays fetched text length: ${txt.length}`);
    const events = parseICS(txt, icsUrl);
    console.log(`DEBUG: caldays parsed ${events.length} events`);

    const windowStart = new Date(`${start}T00:00:00Z`);
    const windowEnd = new Date(`${end}T23:59:59Z`);
    const pad = (n) => String(n).padStart(2, '0');
    const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const days = new Map();
    // Initialize all days in window
    const allKeys = [];
    for (let d = new Date(windowStart.getTime()); d <= windowEnd; d.setDate(d.getDate()+1)) {
      const k = toYmd(d);
      allKeys.push(k);
      days.set(k, []);
    }
    const idxToWd = ["SU","MO","TU","WE","TH","FR","SA"];
    const parseRrule = (rule) => {
      const get = (k) => rule.match(new RegExp(`${k}=([^;]+)`))?.[1];
      return {
        freq: (rule.match(/FREQ=([^;]+)/)?.[1] || '').toUpperCase(),
        interval: parseInt(get('INTERVAL') || '1', 10) || 1,
        byday: (get('BYDAY') || '').split(',').filter(Boolean),
        until: get('UNTIL') || null,
      };
    };

    const exdateSet = (e) => {
      if (!e.exdates?.length) return new Set();
      const s = new Set();
      for (const raw of e.exdates) {
        const iso = toISO(raw);
        if (!iso) continue;
        const d = new Date(iso);
        s.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }
      return s;
    };

    for (const e of events) {
      if (e.title && e.title.includes('Sports Massage')) {
        console.log(`DEBUG: Remote URL processing Sports Massage event - start: ${e.start}, end: ${e.end}, title: ${e.title}`);
      }
      const es = new Date(e.start);
      let ee = new Date(e.end || e.start);
      
      // For all-day events: DTEND is exclusive per RFC, so include all days from start to (end-1)
      if (e.allDay) {
        if (e.endIsDate && e.end) {
          // For VALUE=DATE events, DTEND is the day AFTER the last day
          ee = new Date(ee.getFullYear(), ee.getMonth(), ee.getDate() - 1, 23, 59, 59, 999);
        } else if (!e.end) {
          // No end date, single day
          ee = new Date(es);
        }
        // For timed all-day events, use the original end time
      }
      if (isNaN(es) || isNaN(ee)) continue;

      // Expand weekly RRULEs
      if (e.rrule && /FREQ=WEEKLY/i.test(e.rrule)) {
        const r = parseRrule(e.rrule);
        const exset = exdateSet(e);
        const bydays = r.byday.length ? r.byday : [idxToWd[es.getDay()]];
        const untilDate = r.until ? new Date(toISO(r.until)) : null;
        for (let d = new Date(windowStart.getTime()); d <= windowEnd; d.setDate(d.getDate()+1)) {
          const wd = idxToWd[d.getDay()];
          if (!bydays.includes(wd)) continue;
          const weeks = Math.floor((d.getTime() - es.getTime()) / (7*24*60*60*1000));
          if (weeks < 0 || weeks % r.interval !== 0) continue;
          if (untilDate && d > untilDate) continue;
          const key = toYmd(d);
          if (exset.has(key)) continue;
          const arr = days.get(key) || [];
          let time = null;
          if (!e.allDay) {
            // For timed recurring events, use the original start time
            try {
              time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(es);
            } catch {
              time = null;
            }
          }
          arr.push({ title: e.title, allDay: !!e.allDay, time });
          days.set(key, arr);
        }
        continue;
      }

      // Non-recurring or non-weekly
      if (ee < windowStart || es > windowEnd) {
        if (e.title && e.title.includes('Sports Massage')) {
          console.log(`DEBUG: Remote URL - Sports Massage event filtered out - start: ${es.toISOString()}, end: ${ee.toISOString()}, window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
        }
        continue;
      }
      const d0 = new Date(Math.max(es, windowStart));
      d0.setHours(0,0,0,0);
      const endDay = new Date(Math.min(ee, windowEnd));
      endDay.setHours(0,0,0,0);
      for (let d = new Date(d0); d <= endDay; d.setDate(d.getDate()+1)) {
        const k = toYmd(d);
        const arr = days.get(k) || [];
        let time = null;
        if (!e.allDay) {
          const startKey = toYmd(es);
          if (startKey === k) {
            try {
              time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(es);
            } catch {
              time = null;
            }
          }
        }
        if (arr.length < 3) arr.push({ title: e.title, allDay: !!e.allDay, time });
        days.set(k, arr);
      }
    }

    const out = allKeys.map((k) => {
      const dayEvents = days.get(k) || [];
      // Sort: all-day first, then timed events by time
      const sorted = dayEvents.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        if (!a.allDay && !b.allDay) {
          // Both timed, sort by time
          const timeA = a.time || '23:59';
          const timeB = b.time || '23:59';
          return timeA.localeCompare(timeB);
        }
        return 0; // Both all-day, keep original order
      });
      return { day: k, titles: sorted };
    });
    setCache(key, out, 2*60*1000);
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

    // bump version to invalidate old cached shape/units
    const key = `wx:v2:${lat},${lon}`;
    const c = getCache(key); if (c) return res.json(c);

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
      city: undefined,
      current: {
        temperature: j.current?.temperature_2m,
        summary: mapWx(j.current?.weather_code),
        code: j.current?.weather_code,
      },
      hourly,
      daily,
    };

    setCache(key, out, 5 * 60 * 1000);
    res.json(out);
  } catch (e) {
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
    let icsUrl = String(req.query.u || "");
    icsUrl = decodeURIComponent(icsUrl).replace(/^webcal:\/\//i, 'https://');
    const txt = await fetchText(icsUrl);
    const events = parseICS(txt, icsUrl);
    const filtered = events.filter(e => e.title && (e.title.includes('Sports Massage') || (e.start && e.start.includes('20251029'))));
    res.json({ total: events.length, filtered });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Server listening on http://0.0.0.0:${PORT}`));
