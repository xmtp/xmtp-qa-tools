#!/usr/bin/env node
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

interface Config {
  botName: string;
  env: string;
  nodeBindings: string;
  logLevel: string;
}

function showHelp() {
  console.log(`
XMTP Bot CLI - Interactive bot management

USAGE:
  yarn bot <bot-name> [options]

ARGUMENTS:
  bot-name              Name of the bot to run (echo, key-check)

OPTIONS:
  --env <environment>   XMTP environment (local, dev, production) [default: production]
  --nodeBindings <version>   XMTP Node SDK version to use [default: latest]
  --log <level>         Logging level (info, warn, error) [default: info]
  -h, --help           Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network (default)
  production  Production XMTP network

AVAILABLE BOTS:
  echo        Echo bot - responds to messages
  key-check   Key validation, fork detection, and UX demo bot

EXAMPLES:
  yarn bot echo --env dev
  yarn bot key-check --env local
  yarn bot key-check --help

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  let botName = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--env" && nextArg) {
      process.env.XMTP_ENV = nextArg;
      i++;
    } else if (arg === "--nodeBindings" && nextArg) {
      process.env.NODE_VERSION = nextArg;
      i++;
    } else if (arg === "--log" && nextArg) {
      process.env.LOGGING_LEVEL = nextArg;
      i++;
    } else if (!botName) {
      // First non-flag argument is the bot name
      botName = arg;
    }
  }

  return {
    botName,
    env: process.env.XMTP_ENV as string,
    nodeBindings: process.env.NODE_VERSION as string,
    logLevel: process.env.LOGGING_LEVEL as string,
  };
}

async function main() {
  const config = parseArgs();

  if (!config.botName) {
    console.error("Error: Bot name is required");
    console.error("Usage: yarn bot <bot-name> [--env <environment>]");
    console.error("Run 'yarn bot --help' for more information");
    process.exit(1);
  }

  const botPath = join(
    __dirname,
    "..",
    "agents",
    "bots",
    config.botName,
    "index.ts",
  );

  try {
    // Check if the bot directory exists
    const fs = await import("fs");
    const botDir = join(__dirname, "..", "agents", "bots", config.botName);

    if (!fs.existsSync(botDir)) {
      console.error(`Error: Bot '${config.botName}' not found`);
      console.error("Available bots: echo, key-check");
      console.error("Run 'yarn bot --help' for more information");
      process.exit(1);
    }

    if (!fs.existsSync(botPath)) {
      console.error(
        `Error: Bot '${config.botName}' index.ts not found at ${botPath}`,
      );
      process.exit(1);
    }

    console.log(`Starting bot: ${config.botName}`);
    console.log(`Environment: ${config.env}`);
    console.log(`Node SDK: ${config.nodeBindings}`);
    console.log(`Path: ${botPath}`);

    // Run the bot using tsx with environment variable
    const child = spawn("npx", ["tsx", "--watch", botPath], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: {
        ...process.env,
        XMTP_ENV: config.env,
        XMTP_NODE_SDK: config.nodeBindings,
        LOGGING_LEVEL: config.logLevel,
      },
    });

    child.on("error", (error) => {
      console.error(`Failed to start bot: ${error.message}`);
      process.exit(1);
    });

    child.on("exit", () => {
      process.exit(0);
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
