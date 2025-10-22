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
  sectionTitle: "text-[20px] font-semibold tracking-tight mb-3 text-white/90",
  card: "glass-card-dark glass-shadow-dark p-5 motion-fade-up hover-lift text-gray-100",
  grid: "grid gap-6 xl:gap-8",
  gridCols: "grid-cols-1 xl:grid-cols-[1fr_15%]",
  heading: "text-[36px] xl:text-[44px] font-bold tracking-tight text-white",
  sub: "text-base text-gray-400",
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

function Clock({ tz }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  const timeStr = `${get("hour")}:${get("minute")}:${get("second")}`;

  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  }).format(now);

  return (
    <div className="flex items-baseline gap-8 mb-8">
      <div className="leading-none text-[140px] xl:text-[180px] font-semibold tracking-tight tabular-nums">
        {timeStr}
      </div>
      <div className="text-[90px] xl:text-[110px] text-gray-300 font-medium tracking-tight">{dateStr}</div>
    </div>
  );
}

function iconFor(code) {
  // minimal mapping (can expand later)
  if (code === 0) return "☀️";
  if ([1,2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45,48].includes(code)) return "🌫️";
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return "🌧️";
  if ([71,73,75,77,85,86].includes(code)) return "❄️";
  if ([95,96,99].includes(code)) return "⛈️";
  return "🌡️";
}

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return "-";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
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

  const { current, hourly, daily } = data;
  return (
    <div className={defaultStyle.card}>
      <div className="flex items-baseline justify-end">
        <div className={defaultStyle.sub}>{data.city ?? ""}</div>
      </div>
      <div className="flex items-center gap-5 xl:gap-6">
        <div className="text-[56px] xl:text-[64px] leading-none">{iconFor(current?.code)}</div>
        <div className="text-[60px] xl:text-[115px] leading-none font-semibold">{Math.round(current?.temperature)}°</div>
        <div className="text-gray-300 text-xl xl:text-xl">{current?.summary ?? ""}</div>
      </div>

      {/* Today snapshots: 08:00, 13:00, 18:00 */}
      <div className="mt-5 xl:mt-6 grid grid-cols-3 gap-7">
        {(() => {
          const targets = [8, 13, 18];
          const byHour = new Map((hourly || []).map(h => [new Date(h.time).getHours(), h]));
          return targets.map((hr, i) => {
            const h = byHour.get(hr) || {};
            return (
              <div key={i} className="text-center">
                <div className="text-xl xl:text-xl text-gray-400">{String(hr).padStart(2, '0')}:00</div>
                <div className="text-3xl xl:text-4xl">{iconFor(h.code)}</div>
                <div className="text-xl xl:text-xl font-semibold">{h.temp != null ? Math.round(h.temp) : '-'}°</div>
                <div className="text-base xl:text-xl text-gray-400">
                  {h.windSpeed != null && !Number.isNaN(h.windSpeed) ? Math.round(h.windSpeed) : "-"} mph • {degToCompass(h.windDir)}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* 7-day vertical forecast */}
      <div className="mt-6 xl:mt-7 grid grid-cols-1 gap-4 xl:gap-5">
        {daily?.slice(0, 7).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xl xl:text-xl">
            <div className="text-gray-300 w-44 xl:w-56 truncate">
              {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="w-10 xl:w-12 text-center text-2xl xl:text-3xl">{iconFor(d.code)}</div>
            <div className="text-right tabular-nums w-44 xl:w-56">
              <span className="text-white font-semibold text-xl xl:text-2xl">{Math.round(d.tmax)}°</span>
              <span className="text-gray-400 ml-3 text-xl xl:text-xl">{Math.round(d.tmin)}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Meals card removed

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
            <div className="text-xs text-gray-400">{it.source} • {fmtDate(it.pubDate)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Calendars card removed

function MealsPanel({ apiBase, tz }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);
  
  useEffect(() => {
    console.log('MealsPanel: useEffect triggered');
    console.log('MealsPanel: Making API call to', apiBase);
    const webcal = 'webcal://p46-caldav.icloud.com/published/2/MTMyNjM0ODkwNDEzMjYzNKSpCj-NKjq9g19C5MKQfrSNZyeBCZv5-gFMIpBhNeKjZ7PbpGaJJCJkL0Dp886CKtCK1AatLOY-qQzVRklSaA4';
    const q = encodeURIComponent(webcal);
    const url = `${apiBase}/meals?u=${q}&tz=${encodeURIComponent(tz)}`;
    console.log('MealsPanel: Fetching URL:', url);
    
    // Add a visible debug message
    setItems([{ day: '2025-10-21', title: 'DEBUG: About to fetch' }]);
    
    fetch(url)
      .then(r => {
        console.log('MealsPanel: Response status:', r.status);
        return r.json();
      })
      .then(data => {
        console.log('MealsPanel: Received data:', data);
        setItems(data);
      })
      .catch(err => {
        console.error('MealsPanel: Error:', err);
        setErr(err);
      });
  }, [apiBase, tz]);

  if (err) return <div className={defaultStyle.card}>Meals error: {String(err.message || err)}</div>;
  
  // Reorder to Monday-first week without changing backend data
  const byDay = new Map((items || []).map((d) => [d.day, d]));
  const fmtYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
  const now = new Date();
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(now.getDate() - dow);
  const ordered = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = fmtYmd.format(d);
    return byDay.get(key) || { day: key, title: null };
  });

  return (
    <div className={defaultStyle.card}>
      <h3 className="text-[32px] xl:text-[36px] font-semibold tracking-tight mb-3 text-white/90 text-center">Meals Planner</h3>
      <div className="text-green-400 text-lg mb-4">✅ MealsPanel is rendering!</div>
      <div className="text-yellow-400 text-sm mb-2">API Base: {apiBase}</div>
      <div className="text-yellow-400 text-sm mb-2">Timezone: {tz}</div>
      <div className="text-yellow-400 text-sm mb-2">Items count: {items.length}</div>
      <ul className="space-y-2">
        {ordered.map((e, i) => (
          <li key={i} className="flex items-center justify-between text-xl xl:text-xl">
            <div className="text-gray-300">{new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: tz }).format(new Date(e.day))}</div>
            <div className="text-white font-medium text-right truncate ml-6">{e.title ?? 'NO TITLE'}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthCalendarPanel({ tz, apiBase }) {
  const now = new Date();
  // Find Monday of current week - memoize to prevent constant re-renders
  const monday = useMemo(() => {
    const m = new Date(now);
    const dow = (now.getDay() + 6) % 7; // 0..6 Monday..Sunday
    m.setDate(now.getDate() - dow);
    return m;
  }, [now.getTime() - (now.getTime() % (7 * 24 * 60 * 60 * 1000))]); // Only recalculate weekly

  // Build 4 weeks (28 days)
  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  }), [monday]);

  const wkLabels = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const isToday = (d) => new Date(d).toDateString() === now.toDateString();
  const monthRange = `${new Intl.DateTimeFormat(undefined, { month:'long', timeZone: tz }).format(days[0])} — ${new Intl.DateTimeFormat(undefined, { month:'long', timeZone: tz }).format(days[27])}`;
  
  // Bin icon function
  const getBinIcon = (dayStr) => {
    const binEvents = binEventsByDay[dayStr] || [];
    for (const event of binEvents) {
      const title = event.title || '';
      if (title.includes('Rubbish Bin Collection')) {
        return <span className="text-green-500 text-lg">🗑️</span>; // Green bin
      } else if (title.includes('Recycling Bin Collection')) {
        return <span className="text-blue-500 text-lg">♻️</span>; // Blue bin
      } else if (title.includes('Garden Waste Bin Collection')) {
        return <span className="text-amber-600 text-lg">🍂</span>; // Brown bin
      }
    }
    return null;
  };

  const [eventsByDay, setEventsByDay] = useState({});
  const [binEventsByDay, setBinEventsByDay] = useState({});
  
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
    const startStr = fmt.format(days[0]);
    const endStr = fmt.format(days[27]);
    
    // Fetch main calendar
    const webcal = 'webcal://p46-caldav.icloud.com/published/2/MTMyNjM0ODkwNDEzMjYzNKSpCj-NKjq9g19C5MKQfrTyx9HprnIe03QgHJf3jRCWM8dJ3FjG3_WV2YGQtexKoQIE0pBoM0siWxpoojNJd5U';
    const q = encodeURIComponent(webcal);
    fetch(`${apiBase}/caldays?u=${q}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`)
      .then(r=>r.json())
      .then(arr => {
        const map = {};
        for (const it of arr) map[it.day] = it.titles || [];
        setEventsByDay(map);
      })
      .catch(()=>{});
      
    // Fetch bin collection calendar
    const binPath = '/home/ross/bin_collection.ics';
    const binQ = encodeURIComponent(binPath);
    fetch(`${apiBase}/caldays?u=${binQ}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`)
      .then(r=>r.json())
      .then(arr => {
        const map = {};
        for (const it of arr) map[it.day] = it.titles || [];
        setBinEventsByDay(map);
      })
      .catch(()=>{});
  }, [apiBase, tz, monday]);

  return (
    <div className="fixed left-7 bottom-7 w-[83vw] h-[82vh]">
      <div className={`${defaultStyle.card} w-full h-full p-6 flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[32px] xl:text-[36px] font-semibold tracking-tight text-white/90">{monthRange}</h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xl xl:text-xl text-gray-300 mb-2 font-bold">
          {wkLabels.map((w) => (<div key={w}>{w}</div>))}
        </div>
        <div className="grid grid-cols-7 gap-2 auto-rows-fr flex-1">
          {days.map((d, i) => {
            const k = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
            const titles = eventsByDay[k] || [];
            return (
              <div key={i} className={`rounded-md border border-white/10 flex flex-col p-2 ${isToday(d) ? 'bg-white/10' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getBinIcon(k)}
                  </div>
                  <div className="text-2xl text-white text-right">{d.getDate()}</div>
                </div>
                <div className="mt-1 space-y-1 overflow-hidden">
                  {titles.slice(0,3).map((t, idx) => {
                    const isObj = t && typeof t === 'object';
                    const titleText = isObj ? (t.title ?? '') : String(t ?? '');
                    const isAll = isObj && !!t.allDay;
                    const timeText = (!isAll && isObj && t.time) ? `${t.time} ` : '';
                    const label = `${timeText}${titleText}`.trim();
                    return (
                      <div
                        key={idx}
                        className={`truncate text-[14.4px] xl:text-[18px] ${isAll ? 'bg-white text-neutral-900 rounded px-1 font-medium' : 'text-gray-200'}`}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
    <div className="min-h-screen w-full bg-gradient-to-b from-neutral-900 to-neutral-950 text-white px-6 py-6 xl:px-10 xl:py-10">
      <main className={`${defaultStyle.grid} ${defaultStyle.gridCols}`}>
        <div className="space-y-6">
          <Clock tz={location.tz} />
          {/* Calendars removed */}
        </div>
        <div className="space-y-6 xl:col-start-2 xl:justify-self-end w-full">
          <div className="xl:w-full">
            <WeatherCard apiBase={apiBase} location={location} />
          </div>
          <div className="xl:w-full">
            <div className="text-red-500 text-lg mb-2">DEBUG: About to render MealsPanel</div>
            <MealsPanel apiBase={apiBase} tz={location.tz} />
          </div>
        </div>
      </main>
      <MonthCalendarPanel tz={location.tz} apiBase={apiBase} />
    </div>
  );
}
