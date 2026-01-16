const path = require("path");

const projectRoot = path.resolve(__dirname, "../../..");

module.exports = {
  apps: [
    {
      name: "gm-bot",
      script: "node_modules/.bin/tsx",
      args: "agents/bots/gm/index.ts",
      cwd: projectRoot,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-gm-error.log",
      out_file: "./logs/pm2-gm-out.log",
      restart_delay: 1000,
      min_uptime: 1000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
