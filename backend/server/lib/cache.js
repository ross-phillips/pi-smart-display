export function createCache() {
  const cache = new Map();
  const set = (key, value, ttlMs = 5 * 60 * 1000) => {
    cache.set(key, { value, exp: Date.now() + ttlMs });
  };
  const get = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  };
  const clear = () => cache.clear();
  return { set, get, clear };
}
