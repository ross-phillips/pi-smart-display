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
      { name: "Family Calendar", url: "REMOVED_PRIVATE_CALENDAR_URL" },
      { name: "UK holidays", url: "https://calendar.google.com/calendar/ical/en.uk%23holiday%40group.v.calendar.google.com/public/basic.ics" },
      { name: "Weekly Meals", url: "REMOVED_PRIVATE_CALENDAR_URL" },
    ]}
    feeds={[
      { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }
    ]}
    location={{ lat: 013734, lon: 0492423, tz: "Europe/London" }}
    refreshMs={10 * 60 * 1000}
    apiBase="/api"
  />
);
