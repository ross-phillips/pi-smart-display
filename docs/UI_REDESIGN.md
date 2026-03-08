# Pi Smart Display — UI Redesign Specification

**Target:** An AI agent should be able to implement every change described here by editing `frontend/src/SmartDisplay.jsx`, `frontend/src/SettingsApp.jsx`, `frontend/src/index.css`, and `frontend/tailwind.config.js`.

**Scope:** Visual, layout, and UX improvements only. Backend API contracts are unchanged.

---

## 1. Critical Issues (fix first)

### 1.1 CSS `@import` ordering warning
**File:** `frontend/src/index.css`

The `@import url('https://fonts.googleapis.com/...')` line appears after `@tailwind base;` which is invalid CSS — `@import` must be the first statement. Move it to line 1.

```css
/* BEFORE (broken) */
@tailwind base;
@tailwind components;
@tailwind utilities;
/* ...other rules... */
@import url('https://fonts.googleapis.com/css2?...');

/* AFTER (correct) */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;
/* ...rest of rules... */
```

---

### 1.2 Clock layout overflows on 1080p screens
**File:** `frontend/src/SmartDisplay.jsx` — `Clock` component

The clock is `text-[140px] xl:text-[180px]` and the date beside it is `text-[90px] xl:text-[110px]`. Together in a flex row they overflow horizontally on a 1920×1080 display. The date text is also `text-rose-400` (low contrast on the pink background).

**Fix:** Stack the date below the time, reduce the date text size, and increase its contrast.

```jsx
// BEFORE
<div className="flex items-baseline gap-8 mb-8">
  <div className="leading-none text-[140px] xl:text-[180px] font-semibold tracking-tight tabular-nums text-rose-900">
    {timeStr}
  </div>
  <div className="text-[90px] xl:text-[110px] text-rose-400 font-medium tracking-tight">{dateStr}</div>
</div>

// AFTER
<div className="mb-8">
  <div className="leading-none text-[120px] xl:text-[160px] font-semibold tracking-tight tabular-nums text-rose-900">
    {timeStr}
  </div>
  <div className="text-[32px] xl:text-[40px] text-rose-700 font-medium tracking-tight mt-2">{dateStr}</div>
</div>
```

---

### 1.3 Month calendar requires scrolling
**File:** `frontend/src/SmartDisplay.jsx` — `SmartDisplay` root component

`MonthCalendarPanel` is rendered outside and below the main 2-column grid. On a 1080p display, users must scroll to see it. The kiosk has no mouse/keyboard — scrolling is not possible.

**Fix:** Move `MonthCalendarPanel` into the main left column, below `ContextHighlights` and `NewsCard`, so everything fits in viewport. Or make the root layout a 3-zone grid:

```
┌─────────────────────────────┬────────────────┐
│  Clock                      │  Weather       │
│  Coming Up                  │  Meals         │
│  News                       │                │
├─────────────────────────────┴────────────────┤
│  Month Calendar (full width, fixed height)   │
└──────────────────────────────────────────────┘
```

Implementation in `SmartDisplay` return:

```jsx
// BEFORE
<main className={`${defaultStyle.grid} ${defaultStyle.gridCols}`}>
  <div className="space-y-6">...</div>
  <div className="space-y-6 xl:col-start-2 xl:justify-self-end w-full">...</div>
</main>
{layout?.showCalendar !== false ? <MonthCalendarPanel ... /> : null}

// AFTER — wrap everything including calendar in a single flex column
<div className="flex flex-col gap-6 h-screen overflow-hidden">
  <main className={`${defaultStyle.grid} ${defaultStyle.gridCols} flex-shrink-0`}>
    <div className="space-y-6">...</div>
    <div className="space-y-6 xl:col-start-2 xl:justify-self-end w-full">...</div>
  </main>
  {layout?.showCalendar !== false ? (
    <div className="flex-1 min-h-0">
      <MonthCalendarPanel ... />
    </div>
  ) : null}
</div>
```

Add `overflow: hidden` on `body` in `index.html` or `index.css` to prevent any scroll on the kiosk page.

---

### 1.4 Right column is only 22% wide — too narrow for weather/meals
**File:** `frontend/src/SmartDisplay.jsx` — `defaultStyle.gridCols`

```js
gridCols: "grid-cols-1 xl:grid-cols-[1fr_22%]",
```

At 1920px width, 22% = 422px. This is fine for meals but the weather card's 7-day forecast with text gets cramped. Increase to 30%:

```js
gridCols: "grid-cols-1 xl:grid-cols-[1fr_30%]",
```

---

## 2. Typography

### 2.1 Improve readability at distance

Cormorant Garamond is a high-contrast serif display typeface — beautiful on screens but its thin strokes disappear when viewed from 1.5–2 metres (typical kitchen counter distance). Swap body text and data to a geometric sans-serif while keeping the serif only for the clock and section headings.

**File:** `frontend/src/index.css`

Add Inter to the Google Fonts import:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
```

Update the `:root` font:

```css
:root {
  font-family: "Inter", "SF Pro Display", system-ui, sans-serif;
  background-color: #fef7f7;
}
```

Add a utility class for the display/clock font:

```css
.font-display {
  font-family: "Cormorant Garamond", "Libre Baskerville", serif;
}
```

**File:** `frontend/src/SmartDisplay.jsx`

Apply `.font-display` only to the clock time and section headings:

```jsx
// Clock time
<div className="font-display leading-none text-[120px] xl:text-[160px] ...">

// Section titles — add font-display to defaultStyle.sectionTitle
sectionTitle: "font-display text-[20px] font-semibold tracking-tight mb-3 text-rose-700",
```

---

### 2.2 "Coming Up" dates — format YYYY-MM-DD as human-readable

**File:** `frontend/src/SmartDisplay.jsx` — `ContextHighlights` component

The raw `item.day` value is a `YYYY-MM-DD` string (e.g. `2026-03-09`). Displayed as-is this is unreadable on a wall display.

**Fix:** Format it before rendering:

```jsx
// BEFORE
<span className="text-rose-500">{item.day}</span>

// AFTER
<span className="text-rose-500">
  {new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(item.day + 'T00:00:00'))}
</span>
```

This renders as `Mon 9 Mar` instead of `2026-03-09`.

---

## 3. Color & Visual Hierarchy

### 3.1 Introduce panel accent colours

Currently all panels use identical `text-rose-*` tones making it hard to scan at a glance. Assign each panel a distinct accent without changing the overall warm palette:

| Panel | Current | Proposed accent |
|-------|---------|----------------|
| Clock | rose-900 | unchanged |
| Coming Up | rose-700 | rose-700 (unchanged) |
| News | rose-700 | slate-700 — news is neutral |
| Weather | rose-900/rose-400 | sky-700 / sky-400 |
| Meals | rose-900 | amber-700 |
| Calendar | rose-800 | rose-800 (unchanged) |

**File:** `frontend/src/SmartDisplay.jsx`

In `WeatherCard`, change heading and temperature color:
```jsx
// Current: text-rose-900
// Change temperature and summary to sky tones:
<div className="text-[60px] xl:text-[115px] leading-none font-semibold text-sky-800">
<div className="text-sky-600 text-xl xl:text-xl">
// Day labels in 7-day forecast:
<div className="text-sky-500 w-44 xl:w-56 truncate">
```

In `NewsCard`, change from rose to slate:
```jsx
// sectionTitle for news:
<h3 className="text-[20px] font-semibold tracking-tight mb-3 text-slate-600">Latest News</h3>
// News item titles:
<span className="font-medium text-slate-800">{it.title}</span>
// Source/date:
<div className="text-xs text-slate-400">
```

In `MealsPanel`:
```jsx
<h3 className="... text-amber-800 text-center">Meals Planner</h3>
// Day names:
<div className="text-amber-500">
// Meal titles:
<div className="text-amber-900 font-medium ...">
```

---

### 3.2 Increase "Today" highlight in calendar

**File:** `frontend/src/SmartDisplay.jsx` — `MonthCalendarPanel`

Today's cell uses `bg-white/60` which is barely distinguishable. Make it much more visible:

```jsx
// BEFORE
className={`rounded-md border border-rose-100 flex flex-col p-2 ${isToday(d) ? 'bg-white/60' : ''}`}

// AFTER
className={`rounded-md border flex flex-col p-2 ${
  isToday(d)
    ? 'bg-rose-500 border-rose-500 text-white'
    : 'border-rose-100'
}`}
```

When `isToday(d)` is true, also change the day number to white:
```jsx
<div className={`text-2xl text-right ${isToday(d) ? 'text-white font-bold' : 'text-rose-800'}`}>
  {d.getDate()}
</div>
```

---

### 3.3 Weather icons — replace emoji with Font Awesome icons

Emoji rendering is inconsistent across platforms and Pi's Chromium may render them small or inconsistently. Font Awesome 6 is already loaded in `index.html`. Use FA icons instead:

**File:** `frontend/src/SmartDisplay.jsx` — `iconFor` function

```jsx
// BEFORE — returns emoji strings
function iconFor(code) {
  if (code === 0) return "☀️";
  // ...
}

// AFTER — returns JSX with Font Awesome icons and appropriate colors
function iconFor(code) {
  if (code === 0) return <i className="fas fa-sun text-amber-400" />;
  if ([1,2].includes(code)) return <i className="fas fa-cloud-sun text-amber-300" />;
  if (code === 3) return <i className="fas fa-cloud text-slate-400" />;
  if ([45,48].includes(code)) return <i className="fas fa-smog text-slate-400" />;
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return <i className="fas fa-cloud-rain text-sky-400" />;
  if ([71,73,75,77,85,86].includes(code)) return <i className="fas fa-snowflake text-sky-200" />;
  if ([95,96,99].includes(code)) return <i className="fas fa-bolt text-amber-400" />;
  return <i className="fas fa-thermometer-half text-rose-400" />;
}
```

Note: `iconFor` returns JSX — update all call sites in `WeatherCard` to render it directly (it already renders inline so no changes needed to JSX structure, just ensure the returned value is used in JSX context, which it is in all the `.map()` return values).

---

## 4. Night Mode (Auto-Dim)

**File:** `frontend/src/SmartDisplay.jsx`

Add a `useNightMode` hook that detects the current local hour and returns `true` between 22:00 and 07:00:

```jsx
function useNightMode(tz) {
  const [night, setNight] = useState(false);
  useEffect(() => {
    const check = () => {
      const hour = parseInt(
        new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()),
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
```

Use it in `SmartDisplay`:

```jsx
const isNight = useNightMode(location?.tz);
```

Apply to the root div:

```jsx
<div className={`min-h-screen w-full px-6 py-6 xl:px-10 xl:py-10 text-rose-900 transition-all duration-1000 ${
  isNight ? 'night-mode' : ''
} ${performanceMode ? "performance-mode" : ""}`}>
```

Add night mode CSS to `index.css`:

```css
.night-mode {
  filter: brightness(0.45) saturate(0.8);
}
.night-mode .ambient-bg {
  background: radial-gradient(circle at 50% 50%, rgba(60, 20, 30, 0.9), rgba(20, 5, 10, 1) 100%);
}
```

This dims the whole display to ~45% brightness automatically at night — no sensor required.

---

## 5. Performance Improvements for Pi

### 5.1 Enable performance mode by default in kiosk

**File:** `frontend/src/SmartDisplay.jsx`

Change the default for `performanceMode` from `false` to `true` when running as kiosk (i.e. always, since this only runs on Pi):

```jsx
// Current
const performanceMode = layout?.performanceMode;

// Proposed — default to true, allow override via settings
const performanceMode = layout?.performanceMode ?? true;
```

This disables `backdrop-filter: blur()` and animations which are expensive on Pi's software-rendered Chromium.

### 5.2 Reduce ambient orb animation cost

When `performanceMode` is true (the new default), the orbs are already hidden. But even in non-performance mode, the `blur(20px)` filter on orbs is expensive. Reduce it:

**File:** `frontend/src/index.css`

```css
/* BEFORE */
.ambient-orb {
  filter: blur(20px);
}

/* AFTER */
.ambient-orb {
  filter: blur(40px);  /* larger blur = cheaper, looks smoother */
  will-change: transform; /* hint to compositor */
}
```

---

## 6. Settings App (SettingsApp.jsx) Improvements

### 6.1 Refresh time — milliseconds is not user-friendly

**File:** `frontend/src/SettingsApp.jsx`

The refresh interval is stored as milliseconds but displayed/edited raw. Replace the raw ms input with a minutes selector:

```jsx
// BEFORE
<Field label="Refresh (ms)" hint="Min 60000 (1 min)">
  <input
    className={inputCls}
    type="number"
    min="60000"
    step="60000"
    value={draft.refreshMs ?? ""}
    onChange={(e) => updateDraft({ refreshMs: Number(e.target.value) })}
  />
</Field>

// AFTER
<Field label="Refresh interval" hint="How often the display fetches new data">
  <select
    className={inputCls}
    value={String((draft.refreshMs ?? 900000) / 60000)}
    onChange={(e) => updateDraft({ refreshMs: Number(e.target.value) * 60000 })}
  >
    <option value="5">Every 5 minutes</option>
    <option value="15">Every 15 minutes</option>
    <option value="30">Every 30 minutes</option>
    <option value="60">Every hour</option>
  </select>
</Field>
```

---

### 6.2 Calendars/Feeds textarea — replace pipe format with labeled URL inputs

The `Name | URL` textarea format is fragile and unfriendly. Replace with a dynamic list of name+URL input pairs with Add/Remove buttons:

**File:** `frontend/src/SettingsApp.jsx`

Add a new reusable `UrlList` component:

```jsx
function UrlList({ items, onChange, placeholder = "https://..." }) {
  const add = () => onChange([...items, { name: "", url: "" }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, field, value) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <input
              className={inputCls}
              placeholder="Name (e.g. Family Calendar)"
              value={item.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <input
              className={inputCls}
              placeholder={placeholder}
              value={item.url}
              onChange={(e) => update(i, "url", e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-1 text-rose-400 hover:text-rose-600 text-lg px-2"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-full border border-pink-200 px-4 py-1 text-sm text-pink-600 hover:bg-pink-50 transition"
      >
        + Add
      </button>
    </div>
  );
}
```

Replace the calendars section:

```jsx
// BEFORE
<Field label="Primary Calendars" hint="One per line: Name | URL">
  <textarea
    className={`${inputCls} min-h-[140px]`}
    value={calendarsText}
    onChange={(e) => updateDraft({ calendars: parseList(e.target.value) })}
  />
</Field>

// AFTER
<Field label="Primary Calendars" hint="Add one or more iCloud / Google calendar webcal URLs">
  <UrlList
    items={draft.calendars || []}
    onChange={(val) => updateDraft({ calendars: val })}
    placeholder="webcal://..."
  />
</Field>
```

Replace the feeds section similarly:

```jsx
// BEFORE
<Field label="Feeds" hint="One per line: Name | URL">
  <textarea ... />
</Field>

// AFTER
<Field label="News Feeds" hint="Add RSS/Atom feed URLs">
  <UrlList
    items={draft.feeds || []}
    onChange={(val) => updateDraft({ feeds: val })}
    placeholder="https://feeds.bbci.co.uk/news/rss.xml"
  />
</Field>
```

Remove `feedsText`, `calendarsText`, and `parseList` — they are no longer needed.

---

### 6.3 Theme switching — make palette selector actually do something

The theme palette selector in `SettingsApp` has three options (`kitchen-pink`, `clean-neutral`, `evening-sage`) but `SmartDisplay.jsx` doesn't read `config.theme.palette` and apply any change.

**File:** `frontend/src/SmartDisplay.jsx`

Add palette-to-CSS-class mapping and apply it to the root:

```jsx
const PALETTES = {
  "kitchen-pink": "",                        // default — no extra class
  "clean-neutral": "palette-neutral",
  "evening-sage": "palette-sage",
};

// Inside SmartDisplay component:
const palette = config?.theme?.palette ?? "kitchen-pink";
const paletteClass = PALETTES[palette] ?? "";

// Apply to root div:
<div className={`min-h-screen w-full ... ${paletteClass} ${isNight ? 'night-mode' : ''} ...`}>
```

**File:** `frontend/src/index.css`

Add palette override classes:

```css
/* Clean Neutral palette */
.palette-neutral {
  --color-accent: #64748b;  /* slate */
  --color-bg-from: #f8fafc;
  --color-bg-to: #f1f5f9;
}
.palette-neutral .glass-card-dark {
  border-color: rgba(148, 163, 184, 0.3);
  box-shadow: 0 16px 30px rgba(100, 116, 139, 0.1);
}
.palette-neutral .ambient-bg {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

/* Evening Sage palette */
.palette-sage {
  --color-accent: #4d7c6f;
}
.palette-sage .ambient-bg {
  background:
    radial-gradient(circle at 20% 15%, rgba(200, 230, 220, 0.5), transparent 55%),
    radial-gradient(circle at 80% 80%, rgba(180, 220, 200, 0.4), transparent 60%),
    linear-gradient(180deg, #f0f7f4 0%, #e8f5ef 100%);
}
.palette-sage .glass-card-dark {
  border-color: rgba(100, 180, 150, 0.3);
}
```

---

### 6.4 Add a "Preview" link button in settings

After saving, users have no easy way to jump to the display. Add a link:

**File:** `frontend/src/SettingsApp.jsx`

Add after the save button:

```jsx
<a
  href="/"
  target="_blank"
  rel="noreferrer"
  className="rounded-full border border-neutral-200 px-6 py-2 text-lg text-neutral-500 hover:bg-neutral-50 transition"
>
  Preview display ↗
</a>
```

---

## 7. Summary — Implementation Order

An agent implementing these should work in this order to avoid repeated rebuilds:

| # | Change | File(s) | Risk |
|---|--------|---------|------|
| 1 | Fix CSS `@import` ordering | `index.css` | Low |
| 2 | Fix clock layout (stack date below) | `SmartDisplay.jsx` | Low |
| 3 | Fix calendar outside-grid scrolling | `SmartDisplay.jsx` | Medium |
| 4 | Widen right column to 30% | `SmartDisplay.jsx` | Low |
| 5 | Format "Coming Up" dates | `SmartDisplay.jsx` | Low |
| 6 | Add Inter font, apply to body | `index.css` | Low |
| 7 | Apply `font-display` to clock/headings | `SmartDisplay.jsx` | Low |
| 8 | Replace emoji weather icons with FA icons | `SmartDisplay.jsx` | Low |
| 9 | Introduce panel accent colors | `SmartDisplay.jsx` | Low |
| 10 | Make Today cell clearly highlighted | `SmartDisplay.jsx` | Low |
| 11 | Add night mode hook + CSS | `SmartDisplay.jsx`, `index.css` | Medium |
| 12 | Default `performanceMode` to `true` | `SmartDisplay.jsx` | Low |
| 13 | Settings: Replace ms input with select | `SettingsApp.jsx` | Low |
| 14 | Settings: Replace textarea with `UrlList` | `SettingsApp.jsx` | Medium |
| 15 | Settings: Wire up palette to CSS classes | `SmartDisplay.jsx`, `index.css` | Medium |
| 16 | Settings: Add Preview link button | `SettingsApp.jsx` | Low |

After all changes, run `npm run build` in `frontend/` and `pm2 restart pi-display` on the Pi.
