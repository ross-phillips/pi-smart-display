export function createLogger(enabled = false) {
  return {
    info: (...args) => enabled && console.log(...args),
    warn: (...args) => enabled && console.warn(...args),
    error: (...args) => console.error(...args)
  };
}
