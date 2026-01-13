#!/usr/bin/env node
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { createTestLogger } from "@helpers/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const projectRoot = join(__dirname, "..");

interface Config {
  botName: string;
  env: string;
  nodeBindings: string;
  agentSDK: string;
  logLevel: string;
  fileLogging: boolean;
  pm2: boolean;
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
  --agentSDK <version>  XMTP Agent SDK version to use [default: latest]
  --log <level>         Logging level (info, warn, error) [default: info]
  --file                Enable file logging (saves raw logs to logs/ directory)
  --pm2                 Run bot using PM2 instead of direct execution
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
  yarn bot key-check --agentSDK 1.1.10
  yarn bot key-check --agentSDK 1.1.5 --nodeBindings 1.5.4
  yarn bot key-check --file
  yarn bot key-check --help

For more information, see: cli/readme.md
`);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  let botName = "";
  let fileLogging = false;
  let pm2 = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg.startsWith("--env=")) {
      process.env.XMTP_ENV = arg.split("=", 2)[1]?.trim();
    } else if (arg === "--env" && nextArg) {
      process.env.XMTP_ENV = nextArg.trim();
      i++;
    } else if (arg.startsWith("--nodeBindings=")) {
      process.env.NODE_VERSION = arg.split("=", 2)[1]?.trim();
    } else if (arg === "--nodeBindings" && nextArg) {
      process.env.NODE_VERSION = nextArg.trim();
      i++;
    } else if (arg.startsWith("--agentSDK=")) {
      process.env.AGENT_SDK_VERSION = arg.split("=", 2)[1]?.trim();
    } else if (arg === "--agentSDK" && nextArg) {
      process.env.AGENT_SDK_VERSION = nextArg.trim();
      i++;
    } else if (arg.startsWith("--log=")) {
      process.env.LOGGING_LEVEL = arg.split("=", 2)[1]?.trim();
    } else if (arg === "--log" && nextArg) {
      process.env.LOGGING_LEVEL = nextArg.trim();
      i++;
    } else if (arg === "--file") {
      fileLogging = true;
    } else if (arg === "--pm2") {
      pm2 = true;
    } else if (!botName) {
      // First non-flag argument is the bot name
      botName = arg;
    }
  }

  return {
    botName,
    env: process.env.XMTP_ENV as string,
    nodeBindings: process.env.NODE_VERSION as string,
    agentSDK: process.env.AGENT_SDK_VERSION as string,
    logLevel: process.env.LOGGING_LEVEL as string,
    fileLogging,
    pm2,
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

    // Create logger if file logging is enabled
    const logger = config.fileLogging
      ? createTestLogger({
          fileLogging: true,
          testName: config.botName,
          verboseLogging: true,
          logLevel: config.logLevel || "info",
        })
      : undefined;

    if (config.fileLogging && logger) {
      console.info(`File logging enabled: ${logger.logFileName}`);
    }

    if (config.pm2) {
      const ecosystemPath = join(
        __dirname,
        "..",
        "agents",
        "bots",
        config.botName,
        "ecosystem.config.cjs",
      );

      const logsDir = join(projectRoot, "logs");
      try {
        mkdirSync(logsDir, { recursive: true });
      } catch {
        // Directory might already exist, ignore
      }

      const appName = `${config.botName}-bot`;

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

        const logsProcess = spawn(
          "pm2",
          ["logs", appName, "--raw", "--lines", "1000"],
          {
            stdio: "inherit",
            cwd: projectRoot,
          },
        );

        logsProcess.on("error", (error) => {
          console.error(`Failed to stream logs: ${error.message}`);
          process.exit(1);
        });

        process.on("SIGINT", () => {
          logsProcess.kill();
          process.exit(0);
        });
      });

      return;
    }

    // Run the bot using tsx with environment variable
    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
    };

    if (config.env) {
      childEnv.XMTP_ENV = config.env;
    }
    if (config.nodeBindings) {
      childEnv.XMTP_NODE_SDK = config.nodeBindings;
    }
    if (config.agentSDK) {
      childEnv.AGENT_SDK_VERSION = config.agentSDK;
    }
    if (config.logLevel) {
      childEnv.LOGGING_LEVEL = config.logLevel;
    }

    if (config.env) {
      console.log(`Setting XMTP_ENV=${config.env}`);
    }

    const child = spawn("npx", ["tsx", "--watch", botPath], {
      stdio: config.fileLogging ? ["pipe", "pipe", "pipe"] : "inherit",
      cwd: process.cwd(),
      env: childEnv,
    });

    // Capture output for file logging
    if (config.fileLogging && logger) {
      child.stdout?.on("data", (data: Buffer) => {
        logger.processOutput(data);
      });

      child.stderr?.on("data", (data: Buffer) => {
        logger.processOutput(data);
      });
    }

    child.on("error", (error) => {
      console.error(`Failed to start bot: ${error.message}`);
      logger?.close();
      process.exit(1);
    });

    child.on("exit", () => {
      logger?.close();
      if (config.fileLogging && logger?.logFileName) {
        console.info(`Log file saved: ${logger.logFileName}`);
      }
      process.exit(0);
    });

    // Handle process termination signals
    process.on("SIGINT", () => {
      logger?.close();
      if (config.fileLogging && logger?.logFileName) {
        console.info(`\nLog file saved: ${logger.logFileName}`);
      }
      child.kill();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger?.close();
      if (config.fileLogging && logger?.logFileName) {
        console.info(`\nLog file saved: ${logger.logFileName}`);
      }
      child.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
