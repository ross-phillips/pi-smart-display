const baseDir = process.env.PI_DISPLAY_HOME || "/opt/pi-smart-display";
const port = process.env.PI_DISPLAY_PORT || 8787;

module.exports = {
  apps: [{
    name: "pi-smart-display",
    script: "backend/server/server.js",
    cwd: baseDir,
    env: {
      NODE_ENV: "production",
      PORT: port,
      DATA_DIR: `${baseDir}/data`
    },
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: "10s",
    error_file: `${baseDir}/ops/logs/err.log`,
    out_file: `${baseDir}/ops/logs/out.log`,
    log_file: `${baseDir}/ops/logs/combined.log`,
    time: true
  }]
};
