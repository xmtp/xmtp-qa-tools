import fs from "node:fs";
import { createRequire } from "node:module";
import { getDbPath } from "@helpers/client";
import { Agent, getTestUrl, type LogLevel } from "@xmtp/agent-sdk";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { getActiveVersion } from "version-management/client-versions";
import { CommandHandlers } from "./handlers";

// Command definitions and help text for key-check bot
const COMMANDS = {
  HELP: "help",
  GROUP_ID: "groupid",
  VERSION: "version",
  UPTIME: "uptime",
  DEBUG: "debug",
  MEMBERS: "members",
  INBOX_ID: "inboxid",
  ADDRESS: "address",
  FORK: "fork",
  // UX Demo commands
  UX_HELP: "ux",
  UX_REACTION: "ux-reaction",
  UX_REPLY: "ux-reply",
  UX_ATTACHMENT: "ux-attachment",
  UX_TEXT: "ux-text",
} as const;

const HELP_TEXT =
  "Available commands:\n\n" +
  "**Key Package & Fork Detection:**\n" +
  "/kc - Check key package status for the sender\n" +
  "/kc inboxid <INBOX_ID> - Check key package status for a specific inbox ID\n" +
  "/kc address <ADDRESS> - Check key package status for a specific address\n" +
  "/kc fork - Detect potential conversation forks and show detailed debug info\n\n" +
  "**Conversation Info:**\n" +
  "/kc groupid - Show the current conversation ID\n" +
  "/kc members - List all members' inbox IDs in the current conversation\n\n" +
  "**UX Demo - Message Types:**\n" +
  "/kc ux - Send one of each message type (text, reply, reaction, attachment demo)\n" +
  "/kc ux-reaction - Send a reaction to the last message\n" +
  "/kc ux-reply - Send a reply to the last message\n" +
  "/kc ux-attachment - Show attachment implementation demo\n" +
  "/kc ux-text - Send a regular text message\n\n" +
  "**Bot Info:**\n" +
  "/kc version - Show XMTP SDK version information\n" +
  "/kc uptime - Show when the bot started and how long it has been running\n" +
  "/kc debug - Show debug information for the key-check bot\n" +
  "/kc help - Show this help message";

function parseCommand(content: string): {
  command: string;
  parts: string[];
} {
  const parts = content.trim().split(/\s+/);
  const command = parts.length > 1 ? parts[1] : "";
  return { command, parts };
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
  dbPath: getDbPath(`key-check`),
  codecs: [new ReactionCodec(), new ReplyCodec()],
})) as Agent<any>;

agent.on("text", async (ctx) => {
  const message = ctx.message;
  const content = message.content;

  // Update the last received message for UX demo functionality
  handlers.updateLastMessage(message);

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

    // UX Demo commands
    case COMMANDS.UX_HELP:
      await handlers.handleUxAll(ctx);
      break;

    case COMMANDS.UX_REACTION:
      await handlers.handleUxReaction(ctx);
      break;

    case COMMANDS.UX_REPLY:
      await handlers.handleUxReply(ctx);
      break;

    case COMMANDS.UX_ATTACHMENT:
      await handlers.handleUxAttachment(ctx);
      break;

    case COMMANDS.UX_TEXT:
      await handlers.handleUxText(ctx);
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
  console.log("🔧 Key-Check Bot with UX Demo started!");
  console.log(
    "Features: Key package validation, fork detection, and UX message type demos",
  );
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
