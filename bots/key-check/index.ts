import fs from "node:fs";
import { createRequire } from "node:module";
import { Agent, getTestUrl, type LogLevel } from "@xmtp/agent-sdk";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { getActiveVersion } from "version-management/client-versions";
import { COMMANDS, HELP_TEXT, parseCommand } from "./commands";
import { CommandHandlers } from "./handlers";

export function getDbPath(description: string = "xmtp"): string {
  // Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const xmtpSdkVersion: string =
  packageJson.dependencies[
    "@xmtp/node-sdk-" + getActiveVersion().nodeBindings
  ] ?? "unknown";

// Track when the bot started
const startTime = new Date();

// Initialize command handlers
const handlers = new CommandHandlers(startTime, xmtpSdkVersion);

// 2. Spin up the agent with UX demo codecs
const agent = (await Agent.createFromEnv({
  appVersion: "key-check/0",
  loggingLevel: "warn" as LogLevel,
  dbPath: getDbPath("key-check-" + (process.env.XMTP_ENV ?? "")),
  codecs: [new ReactionCodec(), new ReplyCodec()],
})) as Agent<any>;

agent.on("text", async (ctx) => {
  const message = ctx.message;
  const content = message.content;

  if (!content.trim().startsWith("/kc")) {
    return;
  }

  console.log(`Received command: ${content}`);

  // Parse the command
  const { command, parts } = parseCommand(content);

  // Route to appropriate handler
  switch (command) {
    case COMMANDS.HELP:
      await handlers.handleHelp(ctx, HELP_TEXT);
      break;

    case COMMANDS.GROUP_ID:
      await handlers.handleGroupId(ctx);
      break;

    case COMMANDS.VERSION:
      await handlers.handleVersion(ctx);
      break;

    case COMMANDS.UPTIME:
      await handlers.handleUptime(ctx);
      break;

    case COMMANDS.DEBUG:
      await handlers.handleDebug(ctx);
      break;

    case COMMANDS.MEMBERS:
      await handlers.handleMembers(ctx);
      break;

    case COMMANDS.INBOX_ID:
      if (parts.length > 2) {
        const targetInboxId = parts[2];
        console.log(`Looking up inbox ID: ${targetInboxId}`);
        await handlers.handleKeyPackageCheck(ctx, targetInboxId);
      }
      break;

    case COMMANDS.ADDRESS:
      if (parts.length > 2) {
        const targetAddress = parts[2];
        console.log(`Looking up address: ${targetAddress}`);
        await handlers.handleKeyPackageCheck(ctx, "", targetAddress);
      }
      break;

    case COMMANDS.FORK:
      await handlers.handleForkDetection(ctx);
      break;

    default:
      // Default key package check for sender
      await handlers.handleKeyPackageCheck(ctx, message.senderInboxId);
      break;
  }

  console.log("Waiting for messages...");
});

// 4. Log when we're ready
agent.on("start", () => {
  console.log("🔧 Key-Check Bot started!");
  console.log("Features: Key package validation and fork detection");
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
