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
  initializeAppFromConfig,
  inlineActionsMiddleware,
  registerAction,
  sendActions,
  showMenu,
  type AppConfig,
  type MenuAction,
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

// Helper function for navigation after actions
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
    .add("main-menu", "⬅️ Main Menu")
    .build();

  await sendActions(ctx, navigationMenu);
}

// Ultra-simple app config with handlers DIRECTLY inline
const appConfig: AppConfig = {
  name: "key-check",
  menus: {
    "main-menu": {
      id: "main-menu",
      title: "🔧 Key-Check Bot",
      actions: [
        { id: "key-packages-menu", label: "🔑 Key Packages", style: "primary" },
        { id: "debug-tools-menu", label: "🛠️ Debug Tools" },
        { id: "load-test-menu", label: "🧪 Load Testing" },
        { id: "ux-demo-menu", label: "🎨 UX Demo" },
      ],
    },
    "key-packages-menu": {
      id: "key-packages-menu",
      title: "🔑 Key Packages",
      actions: [
        {
          id: "keycheck-sender",
          label: "🔑 Check Mine",
          style: "primary",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleKeyPackageCheck(
              ctx,
              ctx.message.senderInboxId,
            );
            await showNavigationOptions(
              ctx,
              "Your key package check completed!",
            );
          },
        },
        {
          id: "keycheck-inbox",
          label: "🔍 By Inbox ID",
          handler: async (ctx: MessageContext) => {
            await showInboxInputMenu(ctx);
          },
        },
        {
          id: "keycheck-address",
          label: "📧 By Address",
          handler: async (ctx: MessageContext) => {
            await showAddressInputMenu(ctx);
          },
        },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
    "debug-tools-menu": {
      id: "debug-tools-menu",
      title: "🛠️ Debug Tools",
      actions: [
        {
          id: "fork",
          label: "🔀 Detect Forks",
          style: "danger",
          handler: async (ctx: MessageContext) => {
            await forksHandlers.handleForkDetection(ctx);
            await showNavigationOptions(ctx, "Fork detection completed!");
          },
        },
        {
          id: "groupid",
          label: "🆔 Group ID",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleGroupId(ctx);
            await showNavigationOptions(ctx, "Group ID displayed!");
          },
        },
        {
          id: "members",
          label: "👥 Members",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleMembers(ctx);
            await showNavigationOptions(ctx, "Members list displayed!");
          },
        },
        {
          id: "version",
          label: "📦 Version",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleVersion(ctx);
            await showNavigationOptions(ctx, "Version info displayed!");
          },
        },
        {
          id: "uptime",
          label: "⏰ Uptime",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleUptime(ctx);
            await showNavigationOptions(ctx, "Uptime info displayed!");
          },
        },
        {
          id: "debug",
          label: "🐛 Debug",
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleDebug(ctx);
            await showNavigationOptions(ctx, "Debug info displayed!");
          },
        },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
    "ux-demo-menu": {
      id: "ux-demo-menu",
      title: "🎨 UX Demo",
      actions: [
        {
          id: "ux-all",
          label: "🚀 Demo All",
          style: "primary",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxAll(ctx);
            await showNavigationOptions(ctx, "UX demo completed!");
          },
        },
        {
          id: "ux-text",
          label: "📝 Text",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxText(ctx);
            await showNavigationOptions(ctx, "Text demo completed!");
          },
        },
        {
          id: "ux-reaction",
          label: "👍 Reaction",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxReaction(ctx);
            await showNavigationOptions(ctx, "Reaction demo completed!");
          },
        },
        {
          id: "ux-reply",
          label: "💬 Reply",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxReply(ctx);
            await showNavigationOptions(ctx, "Reply demo completed!");
          },
        },
        {
          id: "ux-attachment",
          label: "📎 File",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxAttachment(ctx);
            await showNavigationOptions(ctx, "Attachment demo completed!");
          },
        },
        {
          id: "ux-usdc",
          label: "💰 USDC",
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxUsdc(ctx);
            await showNavigationOptions(ctx, "USDC transaction completed!");
          },
        },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
    "load-test-menu": {
      id: "load-test-menu",
      title: "🧪 Load Testing",
      actions: [
        {
          id: "load-test-10x10",
          label: "🔥 10 Groups × 10 Messages",
          style: "primary",
        },
        {
          id: "load-test-50x10",
          label: "🚀 50 Groups × 10 Messages",
          style: "danger",
        },
        { id: "load-test-1x100", label: "⚡ 1 Group × 100 Messages" },
        { id: "load-test-custom", label: "⚙️ Custom Parameters" },
        { id: "load-test-help", label: "❓ Help & Info" },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
  },
};

// Register additional actions that need navigation back to main
registerAction("help", async (ctx: MessageContext) => {
  await showMenu(ctx, appConfig, "main-menu");
});

registerAction("back-to-main", async (ctx: MessageContext) => {
  console.log("🔍 back-to-main action triggered");
  await showMenu(ctx, appConfig, "main-menu");
});

// Actions that show menus (these will be auto-registered from appConfig)
registerAction("main-menu", async (ctx: MessageContext) => {
  await showMenu(ctx, appConfig, "main-menu");
});

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

// Add load test handlers to the app config
appConfig.menus["load-test-menu"].actions.forEach((action: MenuAction) => {
  if (!action.handler) {
    switch (action.id) {
      case "load-test-10x10":
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest10Groups10Messages(ctx);
          await showNavigationOptions(ctx, "Load test 10×10 completed!");
        };
        break;
      case "load-test-50x10":
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest50Groups10Messages(ctx);
          await showNavigationOptions(ctx, "Load test 50×10 completed!");
        };
        break;
      case "load-test-1x100":
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest1Group100Messages(ctx);
          await showNavigationOptions(ctx, "Load test 1×100 completed!");
        };
        break;
      case "load-test-custom":
        action.handler = async (ctx: MessageContext) => {
          await showCustomLoadTestMenu(ctx);
        };
        break;
      case "load-test-help":
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTestHelp(ctx);
          await showNavigationOptions(ctx, "Load testing help displayed!");
        };
        break;
    }
  }
});

// Initialize the app from config - this registers all handlers
initializeAppFromConfig(appConfig);

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
    await showMenu(ctx, appConfig, "main-menu");
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
  await showMenu(ctx, appConfig, "main-menu");
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
