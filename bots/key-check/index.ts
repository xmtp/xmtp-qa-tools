import { createRequire } from "node:module";
import { getDbPath } from "@helpers/client";
import {
  Agent,
  getTestUrl,
  type LogLevel,
  type MessageContext,
} from "@xmtp/agent-sdk";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import { getActiveVersion } from "version-management/client-versions";
import {
  ActionBuilder,
  getRegisteredActions,
  inlineActionsMiddleware,
  registerAction,
  sendActions,
} from "../utils/inline-actions/inline-actions";
import { ActionsCodec } from "../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../utils/inline-actions/types/IntentContent";
import { DebugHandlers } from "./handlers/debug";
import { ForksHandlers } from "./handlers/forks";
import { LoadTestHandlers } from "./handlers/loadtest";
import { UxHandlers } from "./handlers/ux";

// Key-check bot now uses inline actions instead of text commands

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const xmtpSdkVersion: string =
  packageJson.dependencies[
    "@xmtp/node-sdk-" + getActiveVersion().nodeBindings
  ] ?? "unknown";

// Track when the bot started
const startTime = new Date();

// Initialize handler instances
const uxHandlers = new UxHandlers();
const forksHandlers = new ForksHandlers();
const debugHandlers = new DebugHandlers(startTime, xmtpSdkVersion);
// LoadTestHandlers will be initialized after agent is created

// Register all action handlers

// Main menu
registerAction("help", async (ctx) => {
  await showMainMenu(ctx);
});

registerAction("back-to-main", async (ctx) => {
  console.log("🔍 back-to-main action triggered");
  await showMainMenu(ctx);
});

// Key Packages Section
registerAction("key-packages-menu", async (ctx) => {
  await showKeyPackagesMenu(ctx);
});

registerAction("keycheck-sender", async (ctx) => {
  await debugHandlers.handleKeyPackageCheck(ctx, ctx.message.senderInboxId);
  await showNavigationOptions(ctx, "Your key package check completed!");
});

registerAction("keycheck-inbox", async (ctx) => {
  await showInboxInputMenu(ctx);
});

registerAction("keycheck-address", async (ctx) => {
  await showAddressInputMenu(ctx);
});

// Debug Tools Section
registerAction("debug-tools-menu", async (ctx) => {
  await showDebugToolsMenu(ctx);
});

registerAction("fork", async (ctx) => {
  await forksHandlers.handleForkDetection(ctx);
  await showNavigationOptions(ctx, "Fork detection completed!");
});

registerAction("groupid", async (ctx) => {
  await debugHandlers.handleGroupId(ctx);
  await showNavigationOptions(ctx, "Group ID displayed!");
});

registerAction("version", async (ctx) => {
  await debugHandlers.handleVersion(ctx);
  await showNavigationOptions(ctx, "Version info displayed!");
});

registerAction("uptime", async (ctx) => {
  await debugHandlers.handleUptime(ctx);
  await showNavigationOptions(ctx, "Uptime info displayed!");
});

registerAction("debug", async (ctx) => {
  await debugHandlers.handleDebug(ctx);
  await showNavigationOptions(ctx, "Debug info displayed!");
});

registerAction("members", async (ctx) => {
  await debugHandlers.handleMembers(ctx);
  await showNavigationOptions(ctx, "Members list displayed!");
});

// UX Demo Section
registerAction("ux-demo-menu", async (ctx) => {
  await showUxDemoMenu(ctx);
});

registerAction("ux-all", async (ctx) => {
  await uxHandlers.handleUxAll(ctx);
  await showNavigationOptions(ctx, "UX demo completed!");
});

registerAction("ux-reaction", async (ctx) => {
  await uxHandlers.handleUxReaction(ctx);
  await showNavigationOptions(ctx, "Reaction demo completed!");
});

registerAction("ux-reply", async (ctx) => {
  await uxHandlers.handleUxReply(ctx);
  await showNavigationOptions(ctx, "Reply demo completed!");
});

registerAction("ux-attachment", async (ctx) => {
  await uxHandlers.handleUxAttachment(ctx);
  await showNavigationOptions(ctx, "Attachment demo completed!");
});

registerAction("ux-text", async (ctx) => {
  await uxHandlers.handleUxText(ctx);
  await showNavigationOptions(ctx, "Text demo completed!");
});

registerAction("ux-usdc", async (ctx) => {
  await uxHandlers.handleUxUsdc(ctx);
  await showNavigationOptions(ctx, "USDC transaction completed!");
});

// Load Testing Section - will be registered after agent creation

// Helper functions for menus
async function showMainMenu(ctx: MessageContext) {
  console.log("🔍 showMainMenu called");
  const timestamp = Date.now();
  const mainMenu = ActionBuilder.create(
    `main-menu-${timestamp}`,
    "🔧 Key-Check Bot - Choose a section:",
  )
    .add("key-packages-menu", "🔑 Key Packages", "primary")
    .add("debug-tools-menu", "🛠️ Debug Tools")
    .add("load-test-menu", "🧪 Load Testing")
    .add("ux-demo-menu", "🎨 UX Demo")
    .build();

  console.log("🔍 Sending main menu actions:", mainMenu);
  await sendActions(ctx, mainMenu);
}

async function showKeyPackagesMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const keyPackagesMenu = ActionBuilder.create(
    `key-packages-menu-${timestamp}`,
    "🔑 Key Packages - Choose an option:",
  )
    .add("keycheck-sender", "🔑 Check My Key Package", "primary")
    .add("keycheck-inbox", "🔍 Check by Inbox ID")
    .add("keycheck-address", "📧 Check by Address")
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, keyPackagesMenu);
}

async function showDebugToolsMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const debugToolsMenu = ActionBuilder.create(
    `debug-tools-menu-${timestamp}`,
    "🛠️ Debug Tools - Choose an option:",
  )
    .add("fork", "🔀 Detect Forks", "danger")
    .add("groupid", "🆔 Show Group ID")
    .add("members", "👥 List Members")
    .add("version", "📦 SDK Version")
    .add("uptime", "⏰ Bot Uptime")
    .add("debug", "🐛 Debug Info")
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, debugToolsMenu);
}

async function showLoadTestMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const loadTestMenu = ActionBuilder.create(
    `load-test-menu-${timestamp}`,
    "🧪 Load Testing - Choose a test scenario:",
  )
    .add("load-test-10x10", "🔥 10 Groups × 10 Messages", "primary")
    .add("load-test-50x10", "🚀 50 Groups × 10 Messages", "danger")
    .add("load-test-1x100", "⚡ 1 Group × 100 Messages")
    .add("load-test-custom", "⚙️ Custom Parameters")
    .add("load-test-help", "❓ Help & Info")
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, loadTestMenu);
}

async function showUxDemoMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const uxDemoMenu = ActionBuilder.create(
    `ux-demo-menu-${timestamp}`,
    "🎨 UX Demo - Choose an option:",
  )
    .add("ux-all", "🚀 Demo All Types", "primary")
    .add("ux-text", "📝 Text Message")
    .add("ux-reaction", "👍 Reaction")
    .add("ux-reply", "💬 Reply")
    .add("ux-attachment", "📎 Real Attachment")
    .add("ux-usdc", "💰 USDC Transaction")
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, uxDemoMenu);
}

async function showInboxInputMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const inputMenu = ActionBuilder.create(
    `inbox-input-menu-${timestamp}`,
    "🔍 Check by Inbox ID",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, inputMenu);
  await ctx.conversation.send(
    "Please send the Inbox ID (64 hex characters) you want to check as a regular text message.",
  );
}

async function showAddressInputMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const inputMenu = ActionBuilder.create(
    `address-input-menu-${timestamp}`,
    "📧 Check by Address",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, inputMenu);
  await ctx.conversation.send(
    "Please send the Ethereum address (0x + 40 hex characters) you want to check as a regular text message.",
  );
}

async function showCustomLoadTestMenu(ctx: MessageContext) {
  const timestamp = Date.now();
  const customMenu = ActionBuilder.create(
    `custom-load-test-menu-${timestamp}`,
    "⚙️ Custom Load Test",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, customMenu);
  await ctx.conversation.send(
    "Please send your custom parameters as a text message in the format:\n" +
      "**groups messages**\n\n" +
      "Examples:\n" +
      "• `5 20` = 5 groups × 20 messages\n" +
      "• `100 1` = 100 groups × 1 message\n" +
      "• `3 50` = 3 groups × 50 messages",
  );
}

async function showNavigationOptions(ctx: MessageContext, message: string) {
  const timestamp = Date.now();
  const navigationMenu = ActionBuilder.create(
    `navigation-options-${timestamp}`,
    message,
  )
    .add("key-packages-menu", "🔑 Key Packages")
    .add("debug-tools-menu", "🛠️ Debug Tools")
    .add("load-test-menu", "🧪 Load Testing")
    .add("ux-demo-menu", "🎨 UX Demo")
    .add("ux-attachment", "📎 Real Attachment")
    .add("ux-usdc", "💰 USDC Transaction")
    .add("back-to-main", "⬅️ Main Menu")
    .build();

  await sendActions(ctx, navigationMenu);
}

// 2. Spin up the agent with UX demo codecs and inline actions
const agent = (await Agent.createFromEnv({
  appVersion: "key-check/0",
  loggingLevel: "warn" as LogLevel,
  dbPath: getDbPath(`key-check`),
  codecs: [
    new ReactionCodec(),
    new ReplyCodec(),
    new RemoteAttachmentCodec(),
    new AttachmentCodec(),
    new WalletSendCallsCodec(),
    new ActionsCodec(),
    new IntentCodec(),
  ],
})) as Agent<any>;

// Add inline actions middleware
agent.use(inlineActionsMiddleware);

// Initialize load test handlers now that agent is available
const loadTestHandlers = new LoadTestHandlers(agent);

// Register load testing actions
registerAction("load-test-menu", async (ctx) => {
  await showLoadTestMenu(ctx);
});

registerAction("load-test-10x10", async (ctx) => {
  await loadTestHandlers.handleLoadTest10Groups10Messages(ctx);
  await showNavigationOptions(ctx, "Load test 10×10 completed!");
});

registerAction("load-test-50x10", async (ctx) => {
  await loadTestHandlers.handleLoadTest50Groups10Messages(ctx);
  await showNavigationOptions(ctx, "Load test 50×10 completed!");
});

registerAction("load-test-1x100", async (ctx) => {
  await loadTestHandlers.handleLoadTest1Group100Messages(ctx);
  await showNavigationOptions(ctx, "Load test 1×100 completed!");
});

registerAction("load-test-custom", async (ctx) => {
  await showCustomLoadTestMenu(ctx);
});

registerAction("load-test-help", async (ctx) => {
  await loadTestHandlers.handleLoadTestHelp(ctx);
  await showNavigationOptions(ctx, "Load testing help displayed!");
});

agent.on("text", async (ctx) => {
  const message = ctx.message;
  const content = message.content;

  // Update the last received message for UX demo functionality
  uxHandlers.updateLastMessage(message);

  // Check if this is a command to show the main menu
  if (
    content.trim().startsWith("/kc") ||
    content.trim().toLowerCase() === "help" ||
    content.trim().toLowerCase() === "menu"
  ) {
    console.log(`Showing main menu for: ${content}`);
    await showMainMenu(ctx);
    return;
  }

  // Check if this might be an inbox ID (64 hex chars without 0x prefix)
  const inboxIdPattern = /^[a-fA-F0-9]{64}$/;
  if (inboxIdPattern.test(content.trim())) {
    console.log(`Detected inbox ID: ${content.trim()}`);
    await debugHandlers.handleKeyPackageCheck(ctx, content.trim());
    await showNavigationOptions(ctx, "Key package check completed!");
    return;
  }

  // Check if this might be an Ethereum address (0x + 40 hex chars)
  const addressPattern = /^0x[a-fA-F0-9]{40}$/;
  if (addressPattern.test(content.trim())) {
    console.log(`Detected Ethereum address: ${content.trim()}`);
    await debugHandlers.handleKeyPackageCheck(ctx, "", content.trim());
    await showNavigationOptions(ctx, "Key package check completed!");
    return;
  }

  // Check if this might be custom load test parameters (groups messages)
  const customLoadTestPattern = /^(\d+)\s+(\d+)$/;
  const customMatch = content.trim().match(customLoadTestPattern);
  if (customMatch) {
    const groups = parseInt(customMatch[1]);
    const messages = parseInt(customMatch[2]);
    console.log(
      `Detected custom load test parameters: ${groups} groups × ${messages} messages`,
    );

    // Validate reasonable limits
    if (groups > 0 && messages > 0 && groups <= 1000 && messages <= 1000) {
      await loadTestHandlers.handleLoadTestCustom(ctx, groups, messages);
      await showNavigationOptions(ctx, "Custom load test completed!");
    } else {
      await ctx.conversation.send(
        "❌ Invalid parameters! Please use reasonable values:\n" +
          "• Groups: 1-1000\n" +
          "• Messages: 1-1000\n\n" +
          "Example: `10 20` for 10 groups × 20 messages",
      );
      await showNavigationOptions(
        ctx,
        "Please try again with valid parameters.",
      );
    }
    return;
  }

  // If it's not a recognized pattern, show the main menu as a fallback
  console.log(`Unrecognized input, showing main menu: ${content}`);
  await showMainMenu(ctx);
});

// 4. Log when we're ready
agent.on("start", () => {
  console.log("🔧 Key-Check Bot with Inline Actions started!");
  console.log(
    "Features: Interactive key package validation, fork detection, and UX message type demos",
  );
  console.log(
    "Usage: Send '/kc', 'help', or 'menu' to see interactive options",
  );
  console.log("Or directly send an Inbox ID or Ethereum address to check");
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);

  // Debug: Log all registered actions
  console.log("🔍 Registered actions:", getRegisteredActions());
});

await agent.start();
