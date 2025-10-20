import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import SmartDisplay from "./SmartDisplay.jsx";

const calendars = [
  { name: "Work", url: "https://calendar.google.com/calendar/ical/.../basic.ics" },
  // { name: "Personal", url: "https://outlook.office365.com/owa/calendar/.../basic.ics" },
];

const feeds = [
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }
];

createRoot(document.getElementById("root")).render(
  <SmartDisplay
    calendars={[
      // { name: "Work", url: "https://calendar.google.com/calendar/ical/.../basic.ics" },
    ]}
    feeds={[
      { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }
    ]}
    location={{ lat: 51.5072, lon: -0.1276, tz: "Europe/London" }}
    refreshMs={10 * 60 * 1000}
    apiBase="http://localhost:8787/api"
  />
);
