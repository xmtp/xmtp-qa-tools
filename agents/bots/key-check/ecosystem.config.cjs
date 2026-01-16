const path = require("path");

const projectRoot = path.resolve(__dirname, "../../..");

module.exports = {
  apps: [
    {
      name: "key-check-bot",
      script: "node_modules/.bin/tsx",
      args: "agents/bots/key-check/index.ts",
      cwd: projectRoot,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-keycheck-error.log",
      out_file: "./logs/pm2-keycheck-out.log",
      restart_delay: 4000,
      min_uptime: 1000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
