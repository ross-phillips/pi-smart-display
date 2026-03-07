import React, { useMemo, useState } from "react";

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

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    className={`h-9 w-16 rounded-full border transition ${value ? "bg-pink-400 border-pink-400" : "bg-neutral-200 border-neutral-300"}`}
    onClick={() => onChange(!value)}
  >
    <span
      className={`block h-8 w-8 rounded-full bg-white shadow transform transition ${value ? "translate-x-7" : "translate-x-0"}`}
    />
  </button>
);

export default function SettingsApp({ config, onConfigUpdate, apiBase = "/api" }) {
  const [draft, setDraft] = useState(config);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [authToken, setAuthToken] = useState("");

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

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      const headers = { "Content-Type": "application/json" };
      if (authToken) headers["x-admin-token"] = authToken;
      const res = await fetch(`${apiBase}/config`, {
        method: "POST",
        headers,
        body: JSON.stringify(draft)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white px-8 py-10 text-neutral-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="text-sm uppercase tracking-[0.3em] text-pink-400">Pi Smart Display</div>
          <h1 className="text-4xl font-semibold">Display Settings</h1>
          <p className="text-neutral-500">Manage content sources, layout, and themes from anywhere.</p>
        </header>

        <Section title="Layout & Modules">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Show Weather">
              <Toggle
                value={draft.layout?.showWeather ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showWeather: value } })}
              />
            </Field>
            <Field label="Show Meals">
              <Toggle
                value={draft.layout?.showMeals ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showMeals: value } })}
              />
            </Field>
            <Field label="Show News">
              <Toggle
                value={draft.layout?.showNews ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showNews: value } })}
              />
            </Field>
            <Field label="Show Calendar">
              <Toggle
                value={draft.layout?.showCalendar ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showCalendar: value } })}
              />
            </Field>
            <Field label="Show Context Highlights">
              <Toggle
                value={draft.layout?.showContext ?? true}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, showContext: value } })}
              />
            </Field>
            <Field label="Performance Mode">
              <Toggle
                value={draft.layout?.performanceMode ?? false}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, performanceMode: value } })}
              />
            </Field>
            <Field label="Reduced Motion">
              <Toggle
                value={draft.layout?.reducedMotion ?? false}
                onChange={(value) => updateDraft({ layout: { ...draft.layout, reducedMotion: value } })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Location & Refresh">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Latitude">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.location?.lat ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, lat: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Longitude">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.location?.lon ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, lon: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Timezone">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.location?.tz ?? ""}
                onChange={(e) => updateDraft({ location: { ...draft.location, tz: e.target.value } })}
              />
            </Field>
            <Field label="Refresh (ms)">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.refreshMs ?? ""}
                onChange={(e) => updateDraft({ refreshMs: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Section>

        <Section title="News Feeds">
          <Field label="Feeds" hint="One per line: Name | URL">
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-neutral-200 px-3 py-2"
              value={feedsText}
              onChange={(e) => updateDraft({ feeds: parseList(e.target.value) })}
            />
          </Field>
        </Section>

        <Section title="Calendars">
          <Field label="Primary Calendars" hint="One per line: Name | URL">
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-neutral-200 px-3 py-2"
              value={calendarsText}
              onChange={(e) => updateDraft({ calendars: parseList(e.target.value) })}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Meals Calendar URL">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.mealsCalendar?.url ?? ""}
                onChange={(e) => updateDraft({ mealsCalendar: { ...draft.mealsCalendar, url: e.target.value } })}
              />
            </Field>
            <Field label="Bin Calendar URL" hint="Optional: leave blank to disable">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={draft.binCalendar?.url ?? ""}
                onChange={(e) => updateDraft({ binCalendar: { ...draft.binCalendar, url: e.target.value } })}
              />
            </Field>
            <Field label="Enable Bin Calendar">
              <Toggle
                value={draft.binCalendar?.enabled ?? false}
                onChange={(value) => updateDraft({ binCalendar: { ...draft.binCalendar, enabled: value } })}
              />
            </Field>
          </div>
        </Section>

        <Section title="Theme">
          <Field label="Theme Palette">
            <select
              className="w-full rounded-xl border border-neutral-200 px-3 py-2"
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
          {config.adminTokenSet ? (
            <Field label="Admin Token" hint="Required to save settings">
              <input
                className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Set New Admin Token" hint="Optional: protect settings changes">
            <input
              className="w-full rounded-xl border border-neutral-200 px-3 py-2"
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
          {status === "saved" ? <span className="text-sm text-green-600">Saved</span> : null}
          {error ? <span className="text-sm text-red-600">{String(error)}</span> : null}
        </div>
      </div>
    </div>
  );
}
