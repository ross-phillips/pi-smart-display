import React, { useEffect, useMemo, useState } from "react";

/**
 * SmartDisplay.jsx
 * Layout: two full-height columns
 *   Left  — Clock · Coming Up · News · Calendar (fills remaining space)
 *   Right — Weather (grows) · Meals (fixed)
 */

// ─── Shared style tokens ──────────────────────────────────────────────────────
const S = {
  card:    "cream-card p-5 motion-fade-up",
  title:   "text-xl font-semibold tracking-tight mb-3 text-stone-700",
  muted:   "text-stone-400",
  primary: "text-stone-800",
  soft:    "text-stone-500",
};

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useRefresh(ms) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

function useNightMode(tz) {
  const [night, setNight] = useState(false);
  useEffect(() => {
    const check = () => {
      const hour = parseInt(
        new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
        10
      );
      setNight(hour >= 22 || hour < 7);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [tz]);
  return night;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d, tz) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit",
      weekday: "short", day: "2-digit", month: "short",
      timeZone: tz,
    }).format(new Date(d));
  } catch {
    return new Date(d).toLocaleString();
  }
}

function iconFor(code) {
  if (code === 0)                                             return <i className="fas fa-sun text-amber-400" />;
  if ([1, 2].includes(code))                                 return <i className="fas fa-cloud-sun text-amber-300" />;
  if (code === 3)                                            return <i className="fas fa-cloud text-stone-400" />;
  if ([45, 48].includes(code))                               return <i className="fas fa-smog text-stone-400" />;
  if ([51,53,55,61,63,65,80,81,82].includes(code))           return <i className="fas fa-cloud-rain text-sky-400" />;
  if ([71,73,75,77,85,86].includes(code))                    return <i className="fas fa-snowflake text-sky-300" />;
  if ([95,96,99].includes(code))                             return <i className="fas fa-bolt text-amber-400" />;
  return <i className="fas fa-thermometer-half text-stone-400" />;
}

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return "-";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

const PALETTES = {
  "kitchen-pink": "",
  "clean-neutral": "palette-neutral",
  "evening-sage":  "palette-sage",
};

// ─── Clock ───────────────────────────────────────────────────────────────────
function Clock({ tz }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: tz,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  const timeStr = `${get("hour")}:${get("minute")}:${get("second")}`;

  const weekdayStr = new Intl.DateTimeFormat(undefined, {
    weekday: "long", timeZone: tz,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "long", year: "numeric", timeZone: tz,
  }).format(now);

  return (
    <div className="flex-shrink-0 flex items-center gap-6">
      {/* Time — large, left */}
      <div className="leading-none text-[110px] xl:text-[148px] font-bold tracking-tight tabular-nums text-stone-900 flex-shrink-0">
        {timeStr}
      </div>
      {/* Date — stacked, right-aligned to remaining space */}
      <div className="flex flex-col justify-center pb-2">
        <div className="text-[26px] xl:text-[34px] font-semibold text-stone-700 leading-tight">
          {weekdayStr}
        </div>
        <div className="text-[22px] xl:text-[28px] text-stone-400 font-normal leading-tight">
          {dateStr}
        </div>
      </div>
    </div>
  );
}

// ─── Weather ─────────────────────────────────────────────────────────────────
function WeatherCard({ apiBase, location, refreshTick }) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${apiBase}/weather?lat=${location.lat}&lon=${location.lon}`, { signal: ctrl.signal })
      .then(r => r.json()).then(setData)
      .catch(e => { if (e.name !== "AbortError") setErr(e); });
    return () => ctrl.abort();
  }, [apiBase, location.lat, location.lon, refreshTick]);

  if (err)   return <div className={`${S.card} flex-1`}>Weather error</div>;
  if (!data) return <div className={`${S.card} flex-1`}>Loading weather…</div>;

  const { current, hourly, daily } = data;
  return (
    <div className={`${S.card} flex-1 min-h-0 flex flex-col overflow-hidden`}>
      {/* City */}
      <div className={`${S.muted} text-right text-sm mb-1`}>{data.city ?? ""}</div>

      {/* Current temp */}
      <div className="flex items-center gap-4">
        <div className="text-[48px] xl:text-[56px] leading-none">{iconFor(current?.code)}</div>
        <div className="text-[72px] xl:text-[96px] leading-none font-bold text-sky-700 tabular-nums">
          {Math.round(current?.temperature)}°
        </div>
        <div className="text-sky-500 text-lg font-medium leading-snug">{current?.summary ?? ""}</div>
      </div>

      {/* 08:00 / 13:00 / 18:00 snapshots */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-stone-100 pt-4">
        {[8, 13, 18].map((hr, i) => {
          const byHour = new Map((hourly || []).map(h => [new Date(h.time).getHours(), h]));
          const h = byHour.get(hr) || {};
          return (
            <div key={i} className="text-center">
              <div className="text-sky-400 text-sm">{String(hr).padStart(2,"0")}:00</div>
              <div className="text-2xl xl:text-3xl my-1">{iconFor(h.code)}</div>
              <div className="font-semibold text-sky-700 text-lg">
                {h.temp != null ? Math.round(h.temp) : "-"}°
              </div>
              <div className={`${S.muted} text-sm`}>
                {h.windSpeed != null ? Math.round(h.windSpeed) : "-"} mph · {degToCompass(h.windDir)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-day forecast — scrolls if needed */}
      <div className="mt-4 border-t border-stone-100 pt-3 flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2">
        {daily?.slice(0, 7).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-lg">
            <div className="text-sky-500 w-36 xl:w-44 truncate font-medium">
              {new Date(d.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div className="text-xl xl:text-2xl">{iconFor(d.code)}</div>
            <div className="text-right tabular-nums w-28 xl:w-36">
              <span className="text-sky-700 font-semibold">{Math.round(d.tmax)}°</span>
              <span className={`${S.muted} ml-2`}>{Math.round(d.tmin)}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── News Ticker ──────────────────────────────────────────────────────────────
// Shows one headline at a time, cycling every 20 s with a fade transition.
const TICKER_INTERVAL_MS  = 20_000;
const TICKER_FADE_MS      = 400;

function NewsTicker({ apiBase, feeds, refreshTick }) {
  const [items, setItems]   = useState([]);
  const [err, setErr]       = useState(null);
  const [idx, setIdx]       = useState(0);
  const [visible, setVisible] = useState(true);

  const feedQuery = useMemo(
    () => feeds.map(f => encodeURIComponent(f.url)).join("&u="),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(feeds)]
  );

  // Fetch headlines
  useEffect(() => {
    if (!feedQuery) return;
    const ctrl = new AbortController();
    fetch(`${apiBase}/news?u=${feedQuery}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setIdx(0); })
      .catch(e => { if (e.name !== "AbortError") setErr(e); });
    return () => ctrl.abort();
  }, [apiBase, feedQuery, refreshTick]);

  // Cycle through items with fade
  useEffect(() => {
    if (items.length < 2) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % items.length);
        setVisible(true);
      }, TICKER_FADE_MS);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [items.length]);

  const item  = items[idx];
  const total = Math.min(items.length, 20);

  // Common wrapper — always visible with clear border so the card never disappears
  const wrap = (children) => (
    <div className="cream-card p-5 flex flex-col min-h-[120px]" style={{ border: "1px solid rgba(180,155,140,0.4)" }}>
      <h3 className={S.title}>News</h3>
      {children}
    </div>
  );

  if (!feedQuery) return wrap(
    <p className={`${S.muted} text-lg`}>Add RSS feeds in Settings to show news.</p>
  );
  if (err)        return wrap(
    <p className="text-red-400 text-lg">News unavailable — check feed URLs in Settings.</p>
  );
  if (!items.length) return wrap(
    <p className={`${S.muted} text-lg`}>Loading news…</p>
  );

  return wrap(
    <>
      {/* Headline — fades between items */}
      <div
        className="flex-1"
        style={{ opacity: visible ? 1 : 0, transition: `opacity ${TICKER_FADE_MS}ms ease` }}
      >
        <p className={`font-medium ${S.primary} text-xl leading-snug`}>
          {item?.title ?? ""}
        </p>
        <p className={`text-sm ${S.muted} mt-2`}>
          {item?.source}{item?.pubDate ? ` · ${fmtDate(item.pubDate)}` : ""}
        </p>
      </div>

      {/* Progress dots */}
      {total > 1 && (
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === idx % total ? "bg-stone-500 w-5" : "bg-stone-200 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Meals ───────────────────────────────────────────────────────────────────
function MealsPanel({ apiBase, tz, refreshTick, mealsUrl }) {
  const [items, setItems] = useState([]);
  const [err, setErr]     = useState(null);

  useEffect(() => {
    if (!mealsUrl) return;
    const ctrl = new AbortController();
    fetch(
      `${apiBase}/meals?u=${encodeURIComponent(mealsUrl)}&tz=${encodeURIComponent(tz)}`,
      { signal: ctrl.signal }
    )
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(new Error(b?.error || `HTTP ${r.status}`))))
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(e => { if (e.name !== "AbortError") setErr(e); });
    return () => ctrl.abort();
  }, [apiBase, tz, refreshTick, mealsUrl]);

  if (err) return <div className={S.card}>Meals error</div>;

  const fmtYmd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" });
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const byDay = new Map((items || []).map(d => [d.day, d]));
  const ordered = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = fmtYmd.format(d);
    return byDay.get(key) || { day: key, title: null };
  });

  return (
    <div className={`${S.card} flex-shrink-0`}>
      <h3 className="text-xl font-semibold tracking-tight mb-3 text-amber-700 text-center">Meals</h3>
      <ul className="space-y-1.5">
        {ordered.map((e, i) => (
          <li key={i} className="flex items-baseline justify-between text-lg gap-3">
            <span className="text-amber-500 font-medium w-24 flex-shrink-0">
              {new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: tz }).format(new Date(e.day))}
            </span>
            <span className="text-amber-800 font-medium text-right truncate min-w-0">
              {e.title ?? <span className="text-stone-300 italic font-normal">—</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Coming Up ───────────────────────────────────────────────────────────────
function ContextHighlights({ apiBase, tz, refreshTick, calendars }) {
  const [items, setItems] = useState([]);
  const [err, setErr]     = useState(null);

  const calQuery = useMemo(
    () => (calendars?.[0]?.url ? encodeURIComponent(calendars[0].url) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(calendars)]
  );

  useEffect(() => {
    if (!calQuery) return;
    const ctrl = new AbortController();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" });
    const now = new Date();
    const end = new Date(now); end.setDate(now.getDate() + 7);
    fetch(
      `${apiBase}/caldays?u=${calQuery}&tz=${encodeURIComponent(tz)}&start=${fmt.format(now)}&end=${fmt.format(end)}`,
      { signal: ctrl.signal }
    )
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(new Error(b?.error || `HTTP ${r.status}`))))
      .then(data => {
        const upcoming = (Array.isArray(data) ? data : [])
          .flatMap(day => (day.titles || []).map(t => ({ day: day.day, title: t.title || t })))
          .filter(it => it.title)
          .slice(0, 5);
        setItems(upcoming);
      })
      .catch(e => { if (e.name !== "AbortError") setErr(e); });
    return () => ctrl.abort();
  }, [apiBase, tz, refreshTick, calQuery]);

  if (!calQuery || err || !items.length) return null;

  return (
    <div className={`${S.card} flex-shrink-0`}>
      <h3 className={S.title}>Coming Up</h3>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex justify-between text-lg gap-4">
            <span className="text-[#B87868] font-medium flex-shrink-0">
              {new Intl.DateTimeFormat(undefined, { weekday:"short", day:"numeric", month:"short" })
                .format(new Date(`${item.day}T00:00:00`))}
            </span>
            <span className={`${S.primary} font-medium truncate`}>{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Month Calendar ───────────────────────────────────────────────────────────
function MonthCalendarPanel({ tz, apiBase, refreshTick, calendars, binCalendar }) {
  const now = new Date();
  const [eventsByDay, setEventsByDay]       = useState({});
  const [binEventsByDay, setBinEventsByDay] = useState({});

  const monday = useMemo(() => {
    const m = new Date(now);
    m.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.getTime() - (now.getTime() % (7 * 24 * 60 * 60 * 1000))]);

  const days = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    }), [monday]);

  const calQuery = useMemo(
    () => (calendars?.[0]?.url ? encodeURIComponent(calendars[0].url) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(calendars)]
  );

  const isToday = (d) => new Date(d).toDateString() === now.toDateString();
  const wkLabels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const monthRange = `${new Intl.DateTimeFormat(undefined, { month:"long", timeZone: tz }).format(days[0])} — ${new Intl.DateTimeFormat(undefined, { month:"long", timeZone: tz }).format(days[27])}`;

  const getBinIcon = (dayStr) => {
    for (const ev of (binEventsByDay[dayStr] || [])) {
      const t = ev.title || "";
      if (t.includes("Rubbish Bin"))   return <i className="fas fa-trash text-green-500 text-sm" />;
      if (t.includes("Recycling Bin")) return <i className="fas fa-recycle text-blue-400 text-sm" />;
      if (t.includes("Garden Waste"))  return <i className="fas fa-leaf text-amber-500 text-sm" />;
    }
    return null;
  };

  useEffect(() => {
    if (!calQuery) return;
    const ctrl = new AbortController();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" });
    const startStr = fmt.format(days[0]);
    const endStr   = fmt.format(days[27]);

    const guardJson = r => r.ok ? r.json() : r.json().then(b => Promise.reject(new Error(b?.error || `HTTP ${r.status}`)));
    const toMap = arr => {
      const m = {};
      for (const it of (Array.isArray(arr) ? arr : [])) m[it.day] = it.titles || [];
      return m;
    };

    fetch(`${apiBase}/caldays?u=${calQuery}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`, { signal: ctrl.signal })
      .then(guardJson).then(a => setEventsByDay(toMap(a)))
      .catch(e => { if (e.name !== "AbortError") console.error("Calendar:", e); });

    if (binCalendar?.enabled && binCalendar?.url) {
      fetch(`${apiBase}/caldays?u=${encodeURIComponent(binCalendar.url)}&tz=${encodeURIComponent(tz)}&start=${startStr}&end=${endStr}`, { signal: ctrl.signal })
        .then(guardJson).then(a => setBinEventsByDay(toMap(a)))
        .catch(e => { if (e.name !== "AbortError") console.error("Bin:", e); });
    }
    return () => ctrl.abort();
  }, [apiBase, tz, monday, refreshTick, calQuery]);

  return (
    <div className="flex-1 min-h-0">
      <div className="cream-card h-full p-4 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 mb-2">
          <h3 className="text-xl font-semibold text-stone-700">{monthRange}</h3>
        </div>
        {/* Day-of-week labels */}
        <div className="flex-shrink-0 grid grid-cols-7 gap-1 text-center text-sm font-semibold text-stone-400 mb-1">
          {wkLabels.map(w => <div key={w}>{w}</div>)}
        </div>
        {/* Day grid — fills remaining height */}
        <div className="flex-1 min-h-0 grid grid-cols-7 gap-1" style={{ gridTemplateRows: "repeat(4, 1fr)" }}>
          {days.map((d, i) => {
            const k = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
            const titles = eventsByDay[k] || [];
            const today = isToday(d);
            return (
              <div
                key={i}
                className={`rounded-lg border flex flex-col p-1.5 overflow-hidden ${
                  today
                    ? "bg-[#C07868] border-[#C07868]"
                    : "border-stone-100 hover:border-stone-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>{getBinIcon(k)}</div>
                  <div className={`text-lg font-semibold leading-none ${today ? "text-white" : "text-stone-600"}`}>
                    {d.getDate()}
                  </div>
                </div>
                <div className="mt-0.5 space-y-0.5 overflow-hidden min-h-0">
                  {titles.map((t, idx) => {
                    const isObj = t && typeof t === "object";
                    const titleText = isObj ? (t.title ?? "") : String(t ?? "");
                    const isAll = isObj && !!t.allDay;
                    const timeText = (!isAll && isObj && t.time) ? `${t.time} ` : "";
                    const label = `${timeText}${titleText}`.trim();
                    return (
                      <div
                        key={idx}
                        className={`truncate text-[11px] xl:text-[13px] leading-tight ${
                          today
                            ? "text-white/90"
                            : isAll
                              ? "bg-stone-100 text-stone-700 rounded px-0.5 font-medium"
                              : "text-stone-500"
                        }`}
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function SmartDisplay({ config, apiBase = "/api" }) {
  const { calendars = [], feeds = [], location, layout, mealsCalendar, binCalendar } = config || {};
  const refreshMs  = config?.refreshMs || 15 * 60 * 1000;
  const refreshTick = useRefresh(refreshMs);
  const apiRoot    = apiBase || "/api";

  // 2-hour full reload to prevent memory creep
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), 2 * 60 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  const stableFeeds     = useMemo(() => feeds,     [JSON.stringify(feeds)]);     // eslint-disable-line
  const stableCalendars = useMemo(() => calendars, [JSON.stringify(calendars)]); // eslint-disable-line

  const reduceMotion    = layout?.reducedMotion;
  const performanceMode = layout?.performanceMode ?? true;
  const isNight         = useNightMode(location?.tz);
  const paletteClass    = PALETTES[config?.theme?.palette ?? "kitchen-pink"] ?? "";

  return (
    <div className={`h-screen w-full overflow-hidden flex text-stone-800 transition-all duration-1000
      ${isNight ? "night-mode" : ""}
      ${performanceMode ? "performance-mode" : ""}
      ${paletteClass}`}
    >
      {/* Ambient background */}
      <div className="cream-bg">
        {!performanceMode && (
          <>
            <div className={`ambient-orb orb-1 ${reduceMotion ? "orb-static" : ""}`} />
            <div className={`ambient-orb orb-2 ${reduceMotion ? "orb-static" : ""}`} />
          </>
        )}
      </div>

      {/* ── Left column: Clock · Coming Up · News · Calendar ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-5 px-6 py-6 xl:px-8 xl:py-7 overflow-hidden">
        <Clock tz={location?.tz} />

        {/* Coming Up + News ticker — side by side at equal width */}
        {(layout?.showContext !== false || layout?.showNews !== false) && (
          <div className="flex gap-5 flex-shrink-0">
            {layout?.showContext !== false && (
              <div className="flex-1 min-w-0">
                <ContextHighlights
                  apiBase={apiRoot} tz={location?.tz}
                  refreshTick={refreshTick} calendars={stableCalendars}
                />
              </div>
            )}
            {layout?.showNews !== false && (
              <div className="flex-1 min-w-0">
                <NewsTicker apiBase={apiRoot} feeds={stableFeeds} refreshTick={refreshTick} />
              </div>
            )}
          </div>
        )}

        {/* Calendar fills whatever vertical space remains */}
        {layout?.showCalendar !== false && (
          <MonthCalendarPanel
            tz={location?.tz} apiBase={apiRoot}
            refreshTick={refreshTick}
            calendars={stableCalendars}
            binCalendar={binCalendar}
          />
        )}
      </div>

      {/* ── Right column: Weather (grows) + Meals (fixed) ── */}
      <div className="flex flex-col gap-5 w-[340px] xl:w-[390px] flex-shrink-0 py-6 xl:py-7 pr-6 xl:pr-8 overflow-hidden">
        {layout?.showWeather !== false && (
          <WeatherCard apiBase={apiRoot} location={location} refreshTick={refreshTick} />
        )}
        {layout?.showMeals !== false && (
          <MealsPanel
            apiBase={apiRoot} tz={location?.tz}
            refreshTick={refreshTick} mealsUrl={mealsCalendar?.url}
          />
        )}
      </div>
    </div>
  );
}
