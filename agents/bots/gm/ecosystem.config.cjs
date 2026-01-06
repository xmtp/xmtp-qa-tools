const path = require("path");

// Config file is at agents/bots/gm/ecosystem.config.cjs
// Go up 3 levels to get to project root
const projectRoot = path.resolve(__dirname, "../../..");

module.exports = {
  apps: [
    {
      name: "gm-bot",
      script: "node_modules/.bin/tsx",
      args: path.join(projectRoot, "agents/bots/gm/index.ts"),
      cwd: projectRoot,
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-gm-error.log",
      out_file: "./logs/pm2-gm-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      max_restarts: Infinity,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
