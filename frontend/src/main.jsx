import "./index.css";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SmartDisplay from "./SmartDisplay.jsx";
import SettingsApp from "./SettingsApp.jsx";

function AppRouter() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const isSettings = window.location.pathname.startsWith("/settings");

  const apiBase = import.meta.env.VITE_API_BASE || "/api";

  // Kiosk display needs overflow:hidden; settings page must scroll freely
  useEffect(() => {
    if (!isSettings) {
      document.documentElement.classList.add("kiosk-mode");
    } else {
      document.documentElement.classList.remove("kiosk-mode");
    }
    return () => document.documentElement.classList.remove("kiosk-mode");
  }, [isSettings]);

  useEffect(() => {
    fetch(`${apiBase}/config`)
      .then((res) => res.json())
      .then(setConfig)
      .catch((err) => setError(err));
  }, [apiBase]);

  if (error) {
    return <div className="p-6 text-red-600">Failed to load config: {String(error)}</div>;
  }

  if (!config) {
    return <div className="p-6 text-neutral-500">Loading display…</div>;
  }

  if (isSettings) {
    return <SettingsApp config={config} onConfigUpdate={setConfig} apiBase={apiBase} />;
  }

  return <SmartDisplay config={config} apiBase={apiBase} />;
}

createRoot(document.getElementById("root")).render(<AppRouter />);
