export default {
  apps: [
    {
      name: "gm-bot",
      script: "npx",
      args: "tsx agents/bots/gm/index.ts",
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      env_dev: {
        NODE_ENV: "development",
        XMTP_ENV: "dev",
      },
      env_production: {
        NODE_ENV: "production",
        XMTP_ENV: "production",
      },
      error_file: "./logs/gm-bot-error.log",
      out_file: "./logs/gm-bot-out.log",
      log_file: "./logs/gm-bot.log",
      time: true,
      merge_logs: true,
    },
  ],
};

