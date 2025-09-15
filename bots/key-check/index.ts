import { createRequire } from "node:module";
import { Agent, getTestUrl, type LogLevel } from "@xmtp/agent-sdk";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { getActiveVersion } from "version-management/client-versions";
import { COMMANDS, HELP_TEXT, parseCommand, UX_HELP_TEXT } from "./commands";
import { CommandHandlers } from "./handlers";
import { getDbPath } from "./utils";

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
      await handlers.handleUxHelp(ctx, UX_HELP_TEXT);
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

    case COMMANDS.UX_ALL:
      await handlers.handleUxAll(ctx);
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
