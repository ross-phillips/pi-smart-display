import fs from "fs";
import { URL } from "url";

const normalizeWebcal = (value) => value.replace(/^webcal:\/\//i, "https://");

export function isAllowedResource(rawUrl, config) {
  if (!config?.allowlist?.enabled) return true;
  if (!rawUrl) return false;
  if (rawUrl.startsWith("/")) {
    return config.allowlist.filePaths?.includes(rawUrl);
  }
  try {
    const url = new URL(normalizeWebcal(rawUrl));
    return config.allowlist.hosts?.includes(url.hostname);
  } catch {
    return false;
  }
}

export async function fetchText(rawUrl, config) {
  if (!isAllowedResource(rawUrl, config)) {
    throw new Error("URL not permitted by allowlist");
  }
  if (rawUrl.startsWith("/")) {
    return fs.readFileSync(rawUrl, "utf8");
  }
  const url = normalizeWebcal(rawUrl);
  const response = await fetch(url, { headers: { "User-Agent": "PiSmartDisplay/2.0" } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
  return await response.text();
}
