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
      log_date_format: "",
      merge_logs: true,
      restart_delay: 1000,
      exp_backoff_restart_delay: 0,
      max_restarts: 10000,
      min_uptime: 1000,
      stop_exit_codes: [],
      unstable_restarts: 10000,
      kill_timeout: 10000,
      listen_timeout: 30000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
