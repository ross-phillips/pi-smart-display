module.exports = {
  apps: [{
    name: 'pi-smart-display',
    script: 'server/server.js',
    cwd: '/home/pi/pi-smart-display',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    error_file: '/home/pi/pi-smart-display/logs/err.log',
    out_file: '/home/pi/pi-smart-display/logs/out.log',
    log_file: '/home/pi/pi-smart-display/logs/combined.log',
    time: true
  }]
};
