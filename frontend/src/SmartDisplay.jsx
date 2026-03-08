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
 *   - refreshMs: number                            // default 15 min
 *   - apiBase: string                              // default "/api"
 */

const defaultStyle = {
  sectionTitle: "text-[20px] font-semibold tracking-tight mb-3 text-rose-700",
  card: "glass-card-dark glass-shadow-dark p-5 motion-fade-up text-rose-900",
  grid: "grid gap-6 xl:gap-8",
  gridCols: "grid-cols-1 xl:grid-cols-[1fr_22%]",
  heading: "text-[36px] xl:text-[44px] font-bold tracking-tight text-rose-800",
  sub: "text-base text-rose-400",
};

function useRefresh(ms) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
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
      <div className="leading-none text-[140px] xl:text-[180px] font-semibold tracking-tight tabular-nums text-rose-900">
        {timeStr}
      </div>
      <div className="text-[90px] xl:text-[110px] text-rose-400 font-medium tracking-tight">{dateStr}</div>
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

function WeatherCard({ apiBase, location, refreshTick }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    const url = `${apiBase}/weather?lat=${location.lat}&lon=${location.lon}`;
    fetch(url, { signal: abortController.signal })
      .then(r => r.json())
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setErr(err);
        }
      });
    return () => abortController.abort();
  }, [apiBase, location.lat, location.lon, refreshTick]);

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
        <div className="text-[60px] xl:text-[115px] leading-none font-semibold text-rose-900">{Math.round(current?.temperature)}°</div>
        <div className="text-rose-600 text-xl xl:text-xl">{current?.summary ?? ""}</div>
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
                <div className="text-xl xl:text-xl text-rose-400">{String(hr).padStart(2, '0')}:00</div>
                <div className="text-3xl xl:text-4xl">{iconFor(h.code)}</div>
                <div className="text-xl xl:text-xl font-semibold text-rose-900">{h.temp != null ? Math.round(h.temp) : '-'}°</div>
                <div className="text-base xl:text-xl text-rose-400">
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
              <div className="text-rose-500 w-44 xl:w-56 truncate">
                {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
              <div className="w-10 xl:w-12 text-center text-2xl xl:text-3xl">{iconFor(d.code)}</div>
              <div className="text-right tabular-nums w-44 xl:w-56">
                <span className="text-rose-900 font-semibold text-xl xl:text-2xl">{Math.round(d.tmax)}°</span>
                <span className="text-rose-400 ml-3 text-xl xl:text-xl">{Math.round(d.tmin)}°</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function NewsCard({ apiBase, feeds, refreshTick }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  // Stable key to avoid re-fetching when feeds array reference changes but content is the same
  const feedQuery = useMemo(
    () => feeds.map(f => encodeURIComponent(f.url)).join("&u="),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(feeds)]
  );

  useEffect(() => {
    if (!feedQuery) return;
    const abortController = new AbortController();
    fetch(`${apiBase}/news?u=${feedQuery}`, { signal: abortController.signal })
      .then(r => r.json())
      .then(setItems)
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setErr(err);
        }
      });
    return () => abortController.abort();
  }, [apiBase, feedQuery, refreshTick]);

  if (err) return <div className={defaultStyle.card}>News error: {String(err)}</div>;
  if (!items?.length) return <div className={defaultStyle.card}>Loading news…</div>;

  return (
    <div className={defaultStyle.card}>
      <h3 className={defaultStyle.sectionTitle}>Latest News</h3>
      <ul className="space-y-3">
        {items.slice(0, 10).map((it, i) => (
          <li key={i} className="leading-snug">
            {/* Links are not useful in kiosk mode — render as plain text */}
            <span className="font-medium text-rose-900">{it.title}</span>
            <div className="text-xs text-rose-400">{it.source} • {fmtDate(it.pubDate)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealsPanel({ apiBase, tz, refreshTick, mealsUrl }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    if (!mealsUrl) return;
    const q = encodeURIComponent(mealsUrl);
    const url = `${apiBase}/meals?u=${q}&tz=${encodeURIComponent(tz)}`;

    fetch(url, { signal: abortController.signal })
      .then(r => r.json())
      .then(data => setItems(data))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setErr(err);
        }
      });
    return () => abortController.abort();
  }, [apiBase, tz, refreshTick, mealsUrl]);

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
    const found = byDay.get(key);
    return found || { day: key, title: null };
  });

  return (
    <div className={defaultStyle.card}>
      <h3 className="text-[32px] xl:text-[36px] font-semibold tracking-tight mb-3 text-rose-800 text-center">Meals Planner</h3>
      <ul className="space-y-2">
        {ordered.map((e, i) => (
          <li key={i} className="flex items-center justify-between text-xl xl:text-xl">
            <div className="text-rose-500">{new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: tz }).format(new Date(e.day))}</div>
            <div className="text-rose-900 font-medium text-right truncate ml-6">
              {e.title ?? <span className="text-rose-300 italic">—</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContextHighlights({ apiBase, tz, refreshTick, calendars }) {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  // Stable query string — avoids re-fetching when calendars array reference changes but content is the same
  const calQuery = useMemo(
    () => (calendars?.[0]?.url ? encodeURIComponent(calendars[0].url) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(calendars)]
  );

  useEffect(() => {
    if (!calQuery) return;
    const abortController = new AbortController();
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
    const startStr = fmt.format(now);
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    const endStr = fmt.format(end);
    fetch(`${apiBase}/caldays?u=${calQuery}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`, { signal: abortController.signal })
      .then((res) => res.json())
      .then((data) => {
        const upcoming = data
          .flatMap((day) => (day.titles || []).map((title) => ({ day: day.day, title: title.title || title })))
          .filter((item) => item.title)
          .slice(0, 5);
        setItems(upcoming);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setErr(error);
      });
    return () => abortController.abort();
  }, [apiBase, tz, refreshTick, calQuery]);

  if (!calQuery) return null;
  if (err) return <div className={defaultStyle.card}>Context error: {String(err)}</div>;
  if (!items.length) return null;

  return (
    <div className={defaultStyle.card}>
      <h3 className={defaultStyle.sectionTitle}>Coming Up</h3>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex justify-between text-lg">
            <span className="text-rose-500">{item.day}</span>
            <span className="text-rose-900 font-medium truncate ml-4">{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthCalendarPanel({ tz, apiBase, refreshTick, calendars, binCalendar }) {
  const now = new Date();

  // State declared first so getBinIcon closure can reference it
  const [eventsByDay, setEventsByDay] = useState({});
  const [binEventsByDay, setBinEventsByDay] = useState({});

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

  // Stable calendar query
  const calQuery = useMemo(
    () => (calendars?.[0]?.url ? encodeURIComponent(calendars[0].url) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(calendars)]
  );

  const wkLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const isToday = (d) => new Date(d).toDateString() === now.toDateString();
  const monthRange = `${new Intl.DateTimeFormat(undefined, { month:'long', timeZone: tz }).format(days[0])} — ${new Intl.DateTimeFormat(undefined, { month:'long', timeZone: tz }).format(days[27])}`;

  // Bin icon function — declared after binEventsByDay state
  const getBinIcon = (dayStr) => {
    const binEvents = binEventsByDay[dayStr] || [];
    for (const event of binEvents) {
      const title = event.title || '';
      if (title.includes('Rubbish Bin Collection')) {
        return <i className="fas fa-trash text-green-500 text-lg"></i>;
      } else if (title.includes('Recycling Bin Collection')) {
        return <i className="fas fa-recycle text-blue-500 text-lg"></i>;
      } else if (title.includes('Garden Waste Bin Collection')) {
        return <i className="fas fa-leaf text-amber-600 text-lg"></i>;
      }
    }
    return null;
  };

  useEffect(() => {
    if (!calQuery) return;
    const abortController = new AbortController();
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
    const startStr = fmt.format(days[0]);
    const endStr = fmt.format(days[27]);

    // Fetch main calendar
    fetch(`${apiBase}/caldays?u=${calQuery}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`, { signal: abortController.signal })
      .then(r=>r.json())
      .then(arr => {
        const map = {};
        for (const it of arr) map[it.day] = it.titles || [];
        setEventsByDay(map);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Calendar fetch error:', err);
        }
      });

    if (binCalendar?.enabled && binCalendar?.url) {
      const binQ = encodeURIComponent(binCalendar.url);
      fetch(`${apiBase}/caldays?u=${binQ}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`, { signal: abortController.signal })
        .then(r=>r.json())
        .then(arr => {
          const map = {};
          for (const it of arr) map[it.day] = it.titles || [];
          setBinEventsByDay(map);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('Bin collection fetch error:', err);
          }
        });
    }

    return () => abortController.abort();
  }, [apiBase, tz, monday, refreshTick, calQuery]);

  return (
    <div className="mt-6">
      <div className={`${defaultStyle.card} w-full p-6 flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[32px] xl:text-[36px] font-semibold tracking-tight text-rose-800">{monthRange}</h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xl xl:text-xl text-rose-400 mb-2 font-bold">
          {wkLabels.map((w) => (<div key={w}>{w}</div>))}
        </div>
        <div className="grid grid-cols-7 gap-2 auto-rows-fr flex-1">
          {days.map((d, i) => {
            const k = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
            const titles = eventsByDay[k] || [];
            return (
              <div key={i} className={`rounded-md border border-rose-100 flex flex-col p-2 ${isToday(d) ? 'bg-white/60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getBinIcon(k)}
                  </div>
                  <div className="text-2xl text-rose-800 text-right">{d.getDate()}</div>
                </div>
                <div className="mt-1 space-y-1 overflow-hidden">
                  {titles.map((t, idx) => {
                    const isObj = t && typeof t === 'object';
                    const titleText = isObj ? (t.title ?? '') : String(t ?? '');
                    const isAll = isObj && !!t.allDay;
                    const timeText = (!isAll && isObj && t.time) ? `${t.time} ` : '';
                    const label = `${timeText}${titleText}`.trim();
                    return (
                      <div
                        key={idx}
                        className={`truncate text-[14.4px] xl:text-[18px] ${isAll ? 'bg-rose-100 text-rose-800 rounded px-1 font-medium' : 'text-rose-700'}`}
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
  config,
  apiBase = "/api",
}) {
  const { calendars = [], feeds = [], location, layout, mealsCalendar, binCalendar } = config || {};
  const refreshMs = config?.refreshMs || 15 * 60 * 1000;
  const refreshTick = useRefresh(refreshMs);
  const apiRoot = apiBase || "/api";

  // Add periodic full page reload to prevent memory issues over long runtimes
  useEffect(() => {
    const fullReloadInterval = 2 * 60 * 60 * 1000; // 2 hours
    const reloadTimer = setTimeout(() => {
      window.location.reload();
    }, fullReloadInterval);
    return () => clearTimeout(reloadTimer);
  }, []);

  // Stable memoised versions of array props — prevents child useEffect deps
  // from firing on every render when array content hasn't actually changed
  const stableFeeds = useMemo(() => feeds, // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(feeds)]);
  const stableCalendars = useMemo(() => calendars, // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(calendars)]);

  const reduceMotion = layout?.reducedMotion;
  const performanceMode = layout?.performanceMode;

  return (
    <div className={`min-h-screen w-full px-6 py-6 xl:px-10 xl:py-10 text-rose-900 ${performanceMode ? "performance-mode" : ""}`}>
      <div className="ambient-bg">
        {!performanceMode ? (
          <>
            <div className={`ambient-orb ${reduceMotion ? "orb-static" : ""}`} style={{ top: "10%", left: "8%" }} />
            <div className={`ambient-orb orb-2 ${reduceMotion ? "orb-static" : ""}`} style={{ bottom: "12%", right: "10%" }} />
          </>
        ) : null}
      </div>
      <main className={`${defaultStyle.grid} ${defaultStyle.gridCols}`}>
        <div className="space-y-6">
          <Clock tz={location?.tz} />
          {layout?.showContext !== false ? (
            <ContextHighlights apiBase={apiRoot} tz={location?.tz} refreshTick={refreshTick} calendars={stableCalendars} />
          ) : null}
          {layout?.showNews !== false ? (
            <NewsCard apiBase={apiRoot} feeds={stableFeeds} refreshTick={refreshTick} />
          ) : null}
        </div>
        <div className="space-y-6 xl:col-start-2 xl:justify-self-end w-full">
          {layout?.showWeather !== false ? (
            <div className="xl:w-full">
              <WeatherCard apiBase={apiRoot} location={location} refreshTick={refreshTick} />
            </div>
          ) : null}
          {layout?.showMeals !== false ? (
            <div className="xl:w-full">
              <MealsPanel apiBase={apiRoot} tz={location?.tz} refreshTick={refreshTick} mealsUrl={mealsCalendar?.url} />
            </div>
          ) : null}
        </div>
      </main>
      {layout?.showCalendar !== false ? (
        <MonthCalendarPanel
          tz={location?.tz}
          apiBase={apiRoot}
          refreshTick={refreshTick}
          calendars={stableCalendars}
          binCalendar={binCalendar}
        />
      ) : null}
    </div>
  );
}
