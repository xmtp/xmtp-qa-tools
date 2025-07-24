#!/usr/bin/env node
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

async function main() {
  const botName = process.argv[2];

  if (!botName) {
    console.error("Usage: yarn bot <bot-name>");
    console.error(
      "Available bots: simple, gm-bot, stress, echo, debug, key-check",
    );
    process.exit(1);
  }

  const botPath = join(__dirname, "..", "bots", botName, "index.ts");

  try {
    // Check if the bot directory exists
    const fs = await import("fs");
    const botDir = join(__dirname, "..", "bots", botName);

    if (!fs.existsSync(botDir)) {
      console.error(
        `Bot '${botName}' not found. Available bots: simple, gm-bot, stress, echo, debug, key-check`,
      );
      process.exit(1);
    }

    if (!fs.existsSync(botPath)) {
      console.error(`Bot '${botName}' index.ts not found at ${botPath}`);
      process.exit(1);
    }

    console.log(`Starting bot: ${botName}`);
    console.log(`Path: ${botPath}`);

    // Run the bot using tsx
    const child = spawn("npx", ["tsx", botPath], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("error", (error) => {
      console.error(`Failed to start bot: ${error.message}`);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
