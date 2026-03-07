import fs from "fs";
import path from "path";

const DEFAULT_CONFIG = {
  appName: "Pi Smart Display",
  location: { lat: 0, lon: 0, tz: "Europe/London", label: "Kitchen" },
  feeds: [
    { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }
  ],
  calendars: [
    {
      name: "Family Calendar",
      url: "REMOVED_PRIVATE_CALENDAR_URL"
    },
    {
      name: "UK Holidays",
      url: "https://calendar.google.com/calendar/ical/en.uk%23holiday%40group.v.calendar.google.com/public/basic.ics"
    }
  ],
  mealsCalendar: {
    name: "Weekly Meals",
    url: "REMOVED_PRIVATE_CALENDAR_URL"
  },
  binCalendar: {
    name: "Bin Collection",
    url: "",
    enabled: false
  },
  layout: {
    variant: "kitchen",
    showWeather: true,
    showMeals: true,
    showNews: true,
    showCalendar: true,
    showContext: true,
    performanceMode: false,
    reducedMotion: false
  },
  theme: {
    palette: "kitchen-pink"
  },
  refreshMs: 15 * 60 * 1000,
  adminToken: "",
  allowlist: {
    enabled: true,
    hosts: [
      "feeds.bbci.co.uk",
      "www.theverge.com",
      "calendar.google.com",
      "p46-caldav.icloud.com"
    ],
    filePaths: ["/opt/pi-smart-display/data/bin_collection.ics"]
  }
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export function getConfigPath() {
  const baseDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
  ensureDir(baseDir);
  return process.env.CONFIG_PATH || path.join(baseDir, "config.json");
}

export function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return mergeConfig(DEFAULT_CONFIG, parsed);
}

export function saveConfig(nextConfig) {
  const configPath = getConfigPath();
  const merged = mergeConfig(DEFAULT_CONFIG, nextConfig);
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
  return merged;
}

export function mergeConfig(base, override) {
  if (!override || typeof override !== "object") return { ...base };
  return {
    ...base,
    ...override,
    location: { ...base.location, ...(override.location || {}) },
    layout: { ...base.layout, ...(override.layout || {}) },
    theme: { ...base.theme, ...(override.theme || {}) },
    allowlist: { ...base.allowlist, ...(override.allowlist || {}) }
  };
}

export function sanitizeConfig(config) {
  const { adminToken, ...rest } = config || {};
  return {
    ...rest,
    adminToken: "",
    adminTokenSet: !!adminToken
  };
}
