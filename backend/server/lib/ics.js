const idxToWd = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function toISO(value) {
  if (!value) return null;
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
  }
  if (/^\d{8}T\d{6}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
  }
  if (/^\d{8}$/.test(value)) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    const d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
    return isNaN(d) ? null : d.toISOString();
  }
  const afterColon = value.includes(":") ? value.split(":").pop() : value;
  const d = new Date(afterColon);
  return isNaN(d) ? null : d.toISOString();
}

export function parseICS(text, label) {
  const lines = text.split(/\r?\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) current = {};
    else if (line.startsWith("END:VEVENT")) {
      if (current) {
        current.calendar = label;
        events.push(current);
      }
      current = null;
    } else if (current) {
      if (line.startsWith("SUMMARY:")) current.title = line.slice(8).trim();
      if (line.startsWith("DTSTART")) {
        const [prop, raw] = line.split(":");
        current.start = raw;
        if (/VALUE=DATE/i.test(prop) || raw.length === 8) current.allDay = true;
      }
      if (line.startsWith("DTEND")) {
        const [prop, raw] = line.split(":");
        current.end = raw;
        if (/VALUE=DATE/i.test(prop) || raw.length === 8) current.endIsDate = true;
      }
      if (line.startsWith("RRULE:")) current.rrule = line.slice(6).trim();
      if (line.startsWith("EXDATE")) {
        const [, raw] = line.split(":");
        const vals = String(raw || "").split(",").map((v) => v.trim()).filter(Boolean);
        current.exdates = [...(current.exdates || []), ...vals];
      }
      if (line.startsWith("LOCATION:")) current.location = line.slice(9).trim();
    }
  }
  return events.map((event) => ({
    ...event,
    start: toISO(event.start),
    end: toISO(event.end)
  })).filter((event) => event.start);
}

const parseRrule = (rule) => {
  const get = (k) => rule.match(new RegExp(`${k}=([^;]+)`))?.[1];
  return {
    freq: (rule.match(/FREQ=([^;]+)/)?.[1] || "").toUpperCase(),
    interval: parseInt(get("INTERVAL") || "1", 10) || 1,
    byday: (get("BYDAY") || "").split(",").filter(Boolean),
    until: get("UNTIL") || null
  };
};

const buildExdateSet = (event) => {
  if (!event.exdates?.length) return new Set();
  const set = new Set();
  for (const raw of event.exdates) {
    const iso = toISO(raw);
    if (!iso) continue;
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    set.add(key);
  }
  return set;
};

export function expandEvents(events, windowStart, windowEnd) {
  const out = [];
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  for (const event of events) {
    const es = new Date(event.start);
    let ee = new Date(event.end || event.start);
    if (event.allDay) {
      if (event.endIsDate && event.end) {
        ee = new Date(ee.getFullYear(), ee.getMonth(), ee.getDate() - 1, 23, 59, 59, 999);
      }
    }
    if (isNaN(es) || isNaN(ee)) continue;
    if (event.rrule && /FREQ=WEEKLY/i.test(event.rrule)) {
      const r = parseRrule(event.rrule);
      const exset = buildExdateSet(event);
      const bydays = r.byday.length ? r.byday : [idxToWd[es.getDay()]];
      const untilDate = r.until ? new Date(toISO(r.until)) : null;
      for (let d = new Date(windowStart.getTime()); d <= windowEnd; d.setDate(d.getDate() + 1)) {
        const wd = idxToWd[d.getDay()];
        if (!bydays.includes(wd)) continue;
        const weeks = Math.floor((d.getTime() - es.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeks < 0 || weeks % r.interval !== 0) continue;
        if (untilDate && d > untilDate) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (exset.has(key)) continue;
        out.push({ ...event, start: new Date(d), end: new Date(d), key });
      }
      continue;
    }
    if (ee.getTime() < startMs || es.getTime() > endMs) continue;
    out.push({ ...event, start: es, end: ee });
  }
  return out;
}

export function mapEventsToDays(events, windowStart, windowEnd, tz) {
  const pad = (n) => String(n).padStart(2, "0");
  const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = new Map();
  const allKeys = [];
  for (let d = new Date(windowStart.getTime()); d <= windowEnd; d.setDate(d.getDate() + 1)) {
    const key = toYmd(d);
    allKeys.push(key);
    days.set(key, []);
  }
  for (const event of events) {
    const es = new Date(event.start);
    let ee = new Date(event.end || event.start);
    if (event.allDay && event.endIsDate && event.end) {
      ee = new Date(ee.getFullYear(), ee.getMonth(), ee.getDate() - 1, 23, 59, 59, 999);
    }
    if (ee < windowStart || es > windowEnd) continue;
    const d0 = new Date(Math.max(es.getTime(), windowStart.getTime()));
    d0.setHours(0, 0, 0, 0);
    const endDay = new Date(Math.min(ee.getTime(), windowEnd.getTime()));
    endDay.setHours(0, 0, 0, 0);
    for (let d = new Date(d0); d <= endDay; d.setDate(d.getDate() + 1)) {
      const key = toYmd(d);
      const arr = days.get(key) || [];
      let time = null;
      if (!event.allDay) {
        const startKey = toYmd(es);
        if (startKey === key) {
          try {
            time = new Intl.DateTimeFormat("en-GB", {
              timeZone: tz,
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            }).format(es);
          } catch {
            time = null;
          }
        }
      }
      arr.push({ title: event.title, allDay: !!event.allDay, time });
      days.set(key, arr);
    }
  }
  return allKeys.map((key) => {
    const sorted = (days.get(key) || []).sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      if (!a.allDay && !b.allDay) {
        const timeA = a.time || "23:59";
        const timeB = b.time || "23:59";
        return timeA.localeCompare(timeB);
      }
      return 0;
    });
    return { day: key, titles: sorted };
  });
}
