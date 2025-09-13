// PM2 Ecosystem Configuration for Talk pAI
// Use with: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'talk-pai',
    script: 'server.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',

    // Environment configuration
    env: {
      NODE_ENV: 'development',
      PORT: 8080
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080
    },

    // Performance optimizations
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',

    // Logging
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '30s',

    // Advanced settings
    kill_timeout: 5000,
    listen_timeout: 8000,

    // Health monitoring
    monitoring: true,
    pmx: true
  }]
};