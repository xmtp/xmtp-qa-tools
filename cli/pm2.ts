#!/usr/bin/env node
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

const botName = process.argv[2] || "gm";

const ecosystemPath = join(
  __dirname,
  "..",
  "agents",
  "bots",
  botName,
  "ecosystem.config.cjs",
);

const child = spawn("pm2", ["start", ecosystemPath], {
  stdio: "inherit",
  cwd: join(__dirname, ".."),
});

child.on("error", (error) => {
  console.error(`Failed to start bot: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
