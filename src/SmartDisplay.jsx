import React, { useEffect, useMemo, useState } from "react";

/**
 * SmartDisplay.jsx
 * A single-file React component showing:
 * - Calendars (via ICS through a local proxy)
 * - Weather (Open-Meteo via proxy)
 * - Latest news (RSS via proxy)
 *
 * Props you can pass:
 *   - calendars: [{ name: string, url: string }]   // ICS URLs
 *   - feeds: [{ name: string, url: string }]       // RSS/Atom feed URLs
 *   - location: { lat: number, lon: number, tz?: string }
 *   - refreshMs: number                            // default 10 min
 *   - apiBase: string                              // default "/api"
 */

const defaultStyle = {
  sectionTitle: "text-xl font-semibold mb-2",
  card: "rounded-2xl shadow p-4 bg-white/80 backdrop-blur-sm border border-black/5",
  grid: "grid gap-4",
  gridCols: "grid-cols-1 xl:grid-cols-3",
  heading: "text-2xl font-bold tracking-tight",
  sub: "text-sm text-gray-500",
};

function useRefresh(ms) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function fmtDate(d, tz) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: tz,
    }).format(new Date(d));
  } catch {
    return new Date(d).toLocaleString();
  }
}

function WeatherCard({ apiBase, location }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const url = `${apiBase}/weather?lat=${location.lat}&lon=${location.lon}`;
    fetch(url).then(r => r.json()).then(setData).catch(setErr);
  }, [apiBase, location.lat, location.lon]);

  if (err) return <div className={defaultStyle.card}>Weather error: {String(err)}</div>;
  if (!data) return <div className={defaultStyle.card}>Loading weather…</div>;

  const { current, hourly } = data;
  return (
    <div className={defaultStyle.card}>
      <div className="flex items-baseline justify-between">
        <h3 className={defaultStyle.sectionTitle}>Weather</h3>
        <div className={defaultStyle.sub}>{data.city ?? ""}</div>
      </div>
      <div className="flex items-end gap-4">
        <div className="text-5xl font-semibold">{Math.round(current?.temperature)}°</div>
        <div className="text-gray-600">{current?.summary ?? ""}</div>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar">
        {hourly?.slice(0, 24)?.map((h, i) => (
          <div key={i} className="min-w-[60px] text-center">
            <div className="text-sm text-gray-500">{new Date(h.time).getHours()}:00</div>
            <div className="text-lg font-medium">{Math.round(h.temp)}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsCard({ apiBase, feeds }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const urls = feeds.map(f => encodeURIComponent(f.url)).join("&u=");
    fetch(`${apiBase}/news?u=${urls}`)
      .then(r => r.json())
      .then(setItems)
      .catch(setErr);
  }, [apiBase, feeds]);

  if (err) return <div className={defaultStyle.card}>News error: {String(err)}</div>;
  if (!items?.length) return <div className={defaultStyle.card}>Loading news…</div>;

  return (
    <div className={defaultStyle.card}>
      <h3 className={defaultStyle.sectionTitle}>Latest News</h3>
      <ul className="space-y-3">
        {items.slice(0, 10).map((it, i) => (
          <li key={i} className="leading-snug">
            <a className="font-medium hover:underline" href={it.link} target="_blank" rel="noreferrer">{it.title}</a>
            <div className="text-xs text-gray-500">{it.source} • {fmtDate(it.pubDate)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarsCard({ apiBase, calendars, tz }) {
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const urls = calendars.map(c => encodeURIComponent(c.url)).join("&u=");
    fetch(`${apiBase}/cal?u=${urls}`)
      .then(r => r.json())
      .then(setEvents)
      .catch(setErr);
  }, [apiBase, calendars]);

  if (err) return <div className={defaultStyle.card}>Calendar error: {String(err)}</div>;
  if (!events?.length) return <div className={defaultStyle.card}>Loading calendars…</div>;

  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.end) >= now)
      .sort((a,b) => new Date(a.start) - new Date(b.start))
      .slice(0, 12);
  }, [events]);

  return (
    <div className={defaultStyle.card}>
      <h3 className={defaultStyle.sectionTitle}>Calendars</h3>
      <ul className="space-y-2">
        {upcoming.map((e, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-xs text-gray-500">{e.calendar ?? ""}</div>
            </div>
            <div className="text-right text-sm text-gray-700">
              <div>{fmtDate(e.start, tz)}</div>
              <div className="text-gray-500">→ {fmtDate(e.end, tz)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SmartDisplay({
  calendars = [],
  feeds = [],
  location = { lat: 51.5072, lon: -0.1276, tz: "Europe/London" },
  refreshMs = 10 * 60 * 1000,
  apiBase = "/api",
}) {
  useRefresh(refreshMs);
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 p-6 xl:p-10">
      <header className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className={defaultStyle.heading}>Home Status</h1>
          <div className={defaultStyle.sub}>{new Date().toLocaleString()}</div>
        </div>
      </header>

      <main className={`${defaultStyle.grid} ${defaultStyle.gridCols}`}>
        <div className="space-y-4">
          <CalendarsCard apiBase={apiBase} calendars={calendars} tz={location.tz} />
          <WeatherCard apiBase={apiBase} location={location} />
        </div>
        <div className="xl:col-span-2">
          <NewsCard apiBase={apiBase} feeds={feeds} />
        </div>
      </main>
    </div>
  );
}
