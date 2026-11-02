/**
 * pm2 start ecosystem.config.cjs
 *
 * Un solo proceso: solo contesta JSON. Los vídeos no pasan por aquí, los sirve
 * Segovia, así que con poca memoria sobra.
 */
module.exports = {
  apps: [
    {
      name: 'merida',
      script: 'src/main.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      node_args: '--env-file-if-exists=.env',
      max_memory_restart: '128M',
      out_file: 'logs/merida.out.log',
      error_file: 'logs/merida.err.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      kill_timeout: 5000,
    },
  ],
};
