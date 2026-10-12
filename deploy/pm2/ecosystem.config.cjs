// PM2 Ecosystem Configuration for Timetable Backend
// Direct Node.js process management without Docker

module.exports = {
  apps: [
    {
      name: 'timetable-backend',
      script: 'src/server.js',
      cwd: '/var/www/timetable/backend',
      instances: 'max', // Multi-core cluster mode
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/timetable/backend-error.log',
      out_file: '/var/log/timetable/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
