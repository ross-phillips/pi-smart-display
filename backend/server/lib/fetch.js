import fs from "fs";
import { URL } from "url";

const normalizeWebcal = (value) => value.replace(/^webcal:\/\//i, "https://");

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PiSmartDisplay/2.0" }
    });
    if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("Response too large (>1 MB)");
    return text;
  } finally {
    clearTimeout(timer);
  }
}
