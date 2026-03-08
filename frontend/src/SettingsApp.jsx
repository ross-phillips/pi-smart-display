import React, { useEffect, useMemo, useState } from "react";

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-pink-100 bg-white/80 p-6 shadow-sm">
    <h2 className="text-2xl font-semibold text-neutral-800 mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </section>
);

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-sm font-medium text-neutral-700 mb-1">{label}</span>
    {children}
    {hint ? <span className="block text-xs text-neutral-500 mt-1">{hint}</span> : null}
  </label>
);

const Toggle = ({ value, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={label}
    className={`h-9 w-16 rounded-full border transition ${value ? "bg-pink-400 border-pink-400" : "bg-neutral-200 border-neutral-300"}`}
    onClick={() => onChange(!value)}
  >
    <span
      className={`block h-8 w-8 rounded-full bg-white shadow transform transition ${value ? "translate-x-7" : "translate-x-0"}`}
    />
  </button>
);

const inputCls = "w-full rounded-xl border border-neutral-200 px-3 py-2";

export default function SettingsApp({ config, onConfigUpdate, apiBase = "/api" }) {
  const [draft, setDraft] = useState(config);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [authToken, setAuthToken] = useState("");

  // Sync draft when config prop changes (e.g. after a successful save)
  useEffect(() => {
    setDraft(config);
  }, [config]);

  const feedsText = useMemo(() => {
    return (draft.feeds || []).map((f) => `${f.name} | ${f.url}`).join("\n");
  }, [draft.feeds]);

  const calendarsText = useMemo(() => {
    return (draft.calendars || []).map((c) => `${c.name} | ${c.url}`).join("\n");
  }, [draft.calendars]);

  const updateDraft = (next) => setDraft((prev) => ({ ...prev, ...next }));

  const parseList = (text) => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, url] = line.split("|").map((part) => part.trim());
        return { name: name || "Untitled", url: url || "" };
      })
      .filter((item) => item.url);
  };

  // Build the payload: merge hostnames from all configured URLs into the allowlist
  const buildPayload = (d) => {
    const allUrls = [
      ...(d.feeds || []).map(f => f.url),
      ...(d.calendars || []).map(c => c.url),
      d.mealsCalendar?.url,
      d.binCalendar?.url,
    ].filter(Boolean);

    const hosts = allUrls
      .filter(u => u.startsWith("http"))
      .map(u => { try { return new URL(u).hostname; } catch { return null; } })
      .filter(Boolean);

    return {
      ...d,
      allowlist: {
        ...d.allowlist,
        hosts: [...new Set([...(d.allowlist?.hosts || []), ...hosts])]
      }
    };
  };

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      const headers = { "Content-Type": "application/json" };
      if (authToken) headers["x-admin-token"] = authToken;
      const payload = buildPayload(draft);
      const res = await fetch(`${apiBase}/config`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      onConfigUpdate(json);
      setDraft(json);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setError(err);
      setStatus("idle");
    }
  };

  const needsSetup = !draft.location?.lat && draft.location?.lat !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white px-8 py-10 text-neutral-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="text-sm uppercase tracking-[0.3em] text-pink-400">Pi Smart Display</div>
          <h1 className="text-4xl font-semibold">Display Settings</h1>
          <p className="text-neutral-500">Manage content sources, layout, and themes from anywhere.</p>
        </header>

        {/* First-run setup banner */}
        {needsSetup ? (
          <div className="rounded-2xl border border-pink-300 bg-pink-50 px-6 py-4 text-pink-800">
            <p className="font-semibold">Setup required</p>
            <p className="text-sm mt-1">Enter your location coordinates and calendar URLs below, then save. The display won't show weather or calendar data until these are configured.</p>
          </div>
        ) : null}

        <Section title="Layout & Modules">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Show Weather">
              <Toggle
                label="Show Weather"
                value={draft.layout?.showWeather ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showWeather: value } })}
              />
            </Field>
            <Field label="Show Meals">
              <Toggle
                label="Show Meals"
                value={draft.layout?.showMeals ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showMeals: value } })}
              />
            </Field>
            <Field label="Show News">
              <Toggle
                label="Show News"
                value={draft.layout?.showNews ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showNews: value } })}
              />
            </Field>
            <Field label="Show Calendar">
              <Toggle
                label="Show Calendar"
                value={draft.layout?.showCalendar ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showCalendar: value } })}
              />
            </Field>
            <Field label="Show Context Highlights">
              <Toggle
                label="Show Context Highlights"
                value={draft.layout?.showContext ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showContext: value } })}
              />
            </Field>
            <Field label="Performance Mode">
              <Toggle
                label="Performance Mode"
                value={draft.layout?.performanceMode ?? false}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, performanceMode: value } })}
              />
            </Field>
            <Field label="Reduced Motion">
              <Toggle
                label="Reduced Motion"
                value={draft.layout?.reducedMotion ?? false}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, reducedMotion: value } })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Location & Refresh">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Latitude" hint="Range: -90 to 90">
              <input
                className={inputCls}
                type="number"
                min="-90"
                max="90"
                step="0.0001"
                value={draft.location?.lat ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, lat: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Longitude" hint="Range: -180 to 180">
              <input
                className={inputCls}
                type="number"
                min="-180"
                max="180"
                step="0.0001"
                value={draft.location?.lon ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, lon: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Location Label" hint="Shown on weather card (e.g. Kitchen)">
              <input
                className={inputCls}
                value={draft.location?.label ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, label: e.target.value } })}
              />
            </Field>
            <Field label="Timezone" hint="e.g. Europe/London">
              <input
                className={inputCls}
                value={draft.location?.tz ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, tz: e.target.value } })}
              />
            </Field>
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
          </div>
        </Section>

        <Section title="News Feeds">
          <Field label="Feeds" hint="One per line: Name | URL">
            <textarea
              className={`${inputCls} min-h-[140px]`}
              value={feedsText}
              onChange={(e) => updateDraft({ feeds: parseList(e.target.value) })}
            />
          </Field>
        </Section>

        <Section title="Calendars">
          <Field label="Primary Calendars" hint="One per line: Name | URL">
            <textarea
              className={`${inputCls} min-h-[140px]`}
              value={calendarsText}
              onChange={(e) => updateDraft({ calendars: parseList(e.target.value) })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meals Calendar URL">
              <input
                className={inputCls}
                value={draft.mealsCalendar?.url ?? ""}
                onChange={(e) => updateDraft({ mealsCalendar: { ...draft.mealsCalendar, url: e.target.value } })}
              />
            </Field>
            <Field label="Bin Calendar URL" hint="Optional: leave blank to disable">
              <input
                className={inputCls}
                value={draft.binCalendar?.url ?? ""}
                onChange={(e) => updateDraft({ binCalendar: { ...draft.binCalendar, url: e.target.value } })}
              />
            </Field>
            <Field label="Enable Bin Calendar">
              <Toggle
                label="Enable Bin Calendar"
                value={draft.binCalendar?.enabled ?? false}
                onChange={(value) => updateDraft({ binCalendar: { ...draft.binCalendar, enabled: value } })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Theme">
          <Field label="Theme Palette">
            <select
              className={inputCls}
              value={draft.theme?.palette ?? "kitchen-pink"}
              onChange={(e) => updateDraft({ theme: { ...draft.theme, palette: e.target.value } })}
            >
              <option value="kitchen-pink">Kitchen Pink</option>
              <option value="clean-neutral">Clean Neutral</option>
              <option value="evening-sage">Evening Sage</option>
            </select>
          </Field>
        </Section>

        <Section title="Layout Presets">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-pink-200 px-4 py-2 text-sm"
              onClick={() => updateDraft({
                layout: { ...draft.layout, showWeather: true, showMeals: true, showNews: false, showCalendar: true, showContext: true }
              })}
            >
              Kitchen Focus
            </button>
            <button
              type="button"
              className="rounded-full border border-pink-200 px-4 py-2 text-sm"
              onClick={() => updateDraft({
                layout: { ...draft.layout, showWeather: true, showMeals: true, showNews: true, showCalendar: true, showContext: true }
              })}
            >
              Family Hub
            </button>
            <button
              type="button"
              className="rounded-full border border-pink-200 px-4 py-2 text-sm"
              onClick={() => updateDraft({
                layout: { ...draft.layout, showWeather: true, showMeals: false, showNews: false, showCalendar: true, showContext: false }
              })}
            >
              Minimal
            </button>
          </div>
        </Section>

        <Section title="Admin Access">
          {/* Warning when no token is set — anyone on the network can change settings */}
          {!config.adminTokenSet ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              ⚠️ No admin token set — anyone on your local network can change settings. Set a token below to require authentication.
            </div>
          ) : null}

          {config.adminTokenSet ? (
            <Field label="Current Admin Token" hint="Required to save settings">
              <input
                className={inputCls}
                type="password"
                autoComplete="current-password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Set New Admin Token" hint="Optional: protect settings changes with a password">
            <input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              value={draft.adminToken ?? ""}
              onChange={(e) => updateDraft({ adminToken: e.target.value })}
            />
          </Field>
        </Section>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-pink-500 text-white px-6 py-2 text-lg font-medium shadow hover:bg-pink-400 transition"
          >
            Save Settings
          </button>
          {status === "saving" ? <span className="text-sm text-neutral-500">Saving…</span> : null}
          {status === "saved" ? <span className="text-sm text-green-600">Saved ✓</span> : null}
          {error ? <span className="text-sm text-red-600">{String(error)}</span> : null}
        </div>
      </div>
    </div>
  );
}
