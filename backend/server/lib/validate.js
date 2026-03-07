const safeArray = (value) => Array.isArray(value) ? value : [];

const clampNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const safeString = (value, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

const safeBool = (value, fallback = false) => {
  return typeof value === "boolean" ? value : fallback;
};

export function normalizeConfig(input) {
  const config = { ...input };
  config.appName = safeString(config.appName, "Pi Smart Display");
  config.refreshMs = clampNumber(config.refreshMs, 15 * 60 * 1000);
  config.adminToken = safeString(config.adminToken, "");

  config.location = {
    lat: clampNumber(config.location?.lat, 0),
    lon: clampNumber(config.location?.lon, 0),
    tz: safeString(config.location?.tz, "Europe/London"),
    label: safeString(config.location?.label, "Kitchen")
  };

  config.layout = {
    variant: safeString(config.layout?.variant, "kitchen"),
    showWeather: safeBool(config.layout?.showWeather, true),
    showMeals: safeBool(config.layout?.showMeals, true),
    showNews: safeBool(config.layout?.showNews, true),
    showCalendar: safeBool(config.layout?.showCalendar, true),
    showContext: safeBool(config.layout?.showContext, true),
    performanceMode: safeBool(config.layout?.performanceMode, false),
    reducedMotion: safeBool(config.layout?.reducedMotion, false)
  };

  config.theme = {
    palette: safeString(config.theme?.palette, "kitchen-pink")
  };

  config.feeds = safeArray(config.feeds)
    .filter((feed) => feed?.url)
    .map((feed) => ({
      name: safeString(feed.name, "Untitled"),
      url: safeString(feed.url, "")
    }))
    .filter((feed) => feed.url);

  config.calendars = safeArray(config.calendars)
    .filter((cal) => cal?.url)
    .map((cal) => ({
      name: safeString(cal.name, "Untitled"),
      url: safeString(cal.url, "")
    }))
    .filter((cal) => cal.url);

  config.mealsCalendar = {
    name: safeString(config.mealsCalendar?.name, "Weekly Meals"),
    url: safeString(config.mealsCalendar?.url, "")
  };

  config.binCalendar = {
    name: safeString(config.binCalendar?.name, "Bin Collection"),
    url: safeString(config.binCalendar?.url, ""),
    enabled: safeBool(config.binCalendar?.enabled, false)
  };

  if (!config.binCalendar.url) {
    config.binCalendar.enabled = false;
  }

  config.allowlist = {
    enabled: safeBool(config.allowlist?.enabled, true),
    hosts: safeArray(config.allowlist?.hosts || []).filter(Boolean),
    filePaths: safeArray(config.allowlist?.filePaths || []).filter(Boolean)
  };

  if (config.binCalendar.url && config.binCalendar.url.startsWith("/")) {
    if (!config.allowlist.filePaths.includes(config.binCalendar.url)) {
      config.allowlist.filePaths.push(config.binCalendar.url);
    }
  }

  return config;
}
