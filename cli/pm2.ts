#!/usr/bin/env node
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const projectRoot = join(__dirname, "..");

const botName = process.argv[2] || "gm";

const ecosystemPath = join(
  __dirname,
  "..",
  "agents",
  "bots",
  botName,
  "ecosystem.config.cjs",
);

const logsDir = join(projectRoot, "logs");
try {
  mkdirSync(logsDir, { recursive: true });
} catch {
  // Directory might already exist, ignore
}

const appName = `${botName}-bot`;

const startProcess = spawn("pm2", ["start", ecosystemPath], {
  stdio: "inherit",
  cwd: projectRoot,
});

startProcess.on("error", (error) => {
  console.error(`Failed to start bot: ${error.message}`);
  process.exit(1);
});

startProcess.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code || 1);
  }

  console.log(`\n[PM2] Starting log stream for ${appName}...\n`);

  const logsProcess = spawn("pm2", ["logs", appName, "--lines", "1000"], {
    stdio: "inherit",
    cwd: projectRoot,
  });

  logsProcess.on("error", (error) => {
    console.error(`Failed to stream logs: ${error.message}`);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    logsProcess.kill();
    process.exit(0);
  });
});
