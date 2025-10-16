import { APP_VERSION } from "@helpers/client";
import { MarkdownCodec } from "@xmtp/content-type-markdown";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import {
  ActionBuilder,
  getRegisteredActions,
  initializeAppFromConfig,
  inlineActionsMiddleware,
  sendActions,
  showMenu,
  showNavigationOptions,
  type AppConfig,
  type MenuAction,
} from "../../utils/inline-actions/inline-actions";
import { ActionsCodec } from "../../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../../utils/inline-actions/types/IntentContent";
import {
  Agent,
  getTestUrl,
  type MessageContext,
} from "../../versions/agent-sdk";
import { DebugHandlers } from "./handlers/debug";
import { ForksHandlers } from "./handlers/forks";
import { GroupHandlers } from "./handlers/groups";
import { LoadTestHandlers } from "./handlers/loadtest";
import { UxHandlers } from "./handlers/ux";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

// Initialize handler instances
const uxHandlers = new UxHandlers();
const forksHandlers = new ForksHandlers();
const debugHandlers = new DebugHandlers();
const groupHandlers = new GroupHandlers();

// Configuration for auto-showing menu after actions
// Set to false to disable automatic menu display after actions
const AUTO_SHOW_MENU_AFTER_ACTION = true;

// Ultra-simple app config with handlers DIRECTLY inline
const appConfig: AppConfig = {
  name: "key-check",
  options: {
    autoShowMenuAfterAction: AUTO_SHOW_MENU_AFTER_ACTION,
    defaultNavigationMessage: "Action completed! Choose your next option:",
  },
  menus: {
    "main-menu": {
      id: "main-menu",
      title:
        "🔧 Hey, this is the Key-Check Bot 🔑\n\n* if appears greyed out, please go back to the conversation list and open the conversation again",

      actions: [
        { id: "key-packages-menu", label: "🔑 Key Packages", style: "primary" },
        { id: "group-tools-menu", label: "👥 Group Tools" },
        { id: "debug-tools-menu", label: "🛠️ Debug Tools" },
        { id: "load-test-menu", label: "🧪 Load Testing" },
        { id: "ux-demo-menu", label: "🎨 UX" },
      ],
    },
    "key-packages-menu": {
      id: "key-packages-menu",
      title: "🔑 Key Packages",
      actions: [
        {
          id: "keycheck-sender",
          label: "🔑 Check Mine",

          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleKeyPackageCheck(
              ctx,
              ctx.message.senderInboxId as string,
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
    "group-tools-menu": {
      id: "group-tools-menu",
      title: "👥 Group Tools",
      actions: [
        {
          id: "group-members",
          label: "👥 Members List",

          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await groupHandlers.handleGroupMembers(ctx);
          },
        },
        {
          id: "group-info",
          label: "ℹ️ Group Info",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await groupHandlers.handleGroupInfo(ctx);
          },
        },
        {
          id: "group-admins",
          label: "👑 Administrators",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await groupHandlers.handleGroupAdmins(ctx);
          },
        },
        {
          id: "group-permissions",
          label: "🔐 Permissions",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await groupHandlers.handleGroupPermissions(ctx);
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
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await forksHandlers.handleForkDetection(ctx);
          },
        },
        {
          id: "debug-info",
          label: "🔧 Debug Info",
          style: "primary",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await debugHandlers.handleDebugInfo(ctx);
          },
        },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
    "ux-demo-menu": {
      id: "ux-demo-menu",
      title: "🎨 UX",
      actions: [
        {
          id: "ux-text-reply-reaction",
          label: "💬👍 Basics",

          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleBasics(ctx);
          },
        },
        {
          id: "ux-markdown",
          label: "🎨 Markdown",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxMarkdown(ctx);
          },
        },
        {
          id: "ux-mini-app",
          label: "📲 Mini App",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxMiniApp(ctx);
          },
        },
        {
          id: "ux-attachment",
          label: "🎇 Image",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleUxAttachment(ctx);
          },
        },
        {
          id: "ux-usdc",
          label: "💰 Transaction",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleTransaction(ctx);
          },
        },
        {
          id: "ux-deeplink",
          label: "🔗 Deeplink",
          showNavigationOptions: true,
          handler: async (ctx: MessageContext) => {
            await uxHandlers.handleDeeplink(ctx);
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
          label: "🔥 10 Groups × 10 Msgs",
        },
        {
          id: "load-test-50x10",
          label: "🚀 50 Groups × 10 Msgs",
        },
        { id: "load-test-1x100", label: "⚡ 1 Group × 100 Msgs" },
        { id: "load-test-custom", label: "⚙️ Custom" },
        { id: "main-menu", label: "⬅️ Back" },
      ],
    },
  },
};

// Note: Common actions like "help", "back-to-main", and "main-menu"
// are automatically registered by initializeAppFromConfig()

async function showInboxInputMenu(ctx: MessageContext) {
  const inputMenu = ActionBuilder.create(
    "inbox-input-menu",
    "🔍 Check by Inbox ID",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, inputMenu);
  await ctx.sendText(
    "Please send the Inbox ID (64 hex characters) you want to check as a regular text message.",
  );
}

async function showAddressInputMenu(ctx: MessageContext) {
  const inputMenu = ActionBuilder.create(
    "address-input-menu",
    "📧 Check by Address",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, inputMenu);
  await ctx.sendText(
    "Please send the Ethereum address (0x + 40 hex characters) you want to check as a regular text message.",
  );
}

async function showCustomLoadTestMenu(ctx: MessageContext) {
  const customMenu = ActionBuilder.create(
    "custom-load-test-menu",
    "⚙️ Custom Load Test",
  )
    .add("back-to-main", "⬅️ Back to Main Menu")
    .build();

  await sendActions(ctx, customMenu);
  await ctx.sendText(
    "Please send your custom parameters as a text message in the format:\n" +
      "**groups messages**\n\n" +
      "Examples:\n" +
      "• `5 20` = 5 groups × 20 messages\n" +
      "• `100 1` = 100 groups × 1 message\n" +
      "• `3 50` = 3 groups × 50 messages",
  );
}

// 2. Spin up the agent with UX demo codecs and inline actions
const agent = await Agent.createFromEnv({
  appVersion: APP_VERSION,
  dbPath: (inboxId) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  codecs: [
    new MarkdownCodec(),
    new ReactionCodec(),
    new ReplyCodec(),
    new RemoteAttachmentCodec(),
    new AttachmentCodec(),
    new WalletSendCallsCodec(),
    new ActionsCodec(),
    new IntentCodec(),
  ],
});

// Add inline actions middleware
agent.use(inlineActionsMiddleware);

// Initialize load test handlers now that agent is available
const loadTestHandlers = new LoadTestHandlers(agent);

// Add load test handlers to the app config
appConfig.menus["load-test-menu"].actions.forEach((action: MenuAction) => {
  if (!action.handler) {
    switch (action.id) {
      case "load-test-10x10":
        action.showNavigationOptions = true;
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest10Groups10Messages(ctx);
        };
        break;
      case "load-test-50x10":
        action.showNavigationOptions = true;
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest50Groups10Messages(ctx);
        };
        break;
      case "load-test-1x100":
        action.showNavigationOptions = true;
        action.handler = async (ctx: MessageContext) => {
          await loadTestHandlers.handleLoadTest1Group100Messages(ctx);
        };
        break;
      case "load-test-custom":
        action.handler = async (ctx: MessageContext) => {
          await showCustomLoadTestMenu(ctx);
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
  const isTagged =
    content.trim().startsWith("@kc") ||
    content.trim().startsWith("/kc") ||
    content.trim().startsWith("@key-check.eth");
  if (isTagged) {
    console.log(`Showing main menu for: ${content}`);
    await showMenu(ctx, appConfig, "main-menu");
    return;
  }

  // Check if this might be an inbox ID (64 hex chars without 0x prefix)
  const inboxIdPattern = /^[a-fA-F0-9]{64}$/;
  if (inboxIdPattern.test(content.trim())) {
    console.log(`Detected inbox ID: ${content.trim()}`);
    await debugHandlers.handleKeyPackageCheck(ctx, content.trim() as string);
    await showNavigationOptions(ctx, appConfig, "Key package check completed!");
    return;
  }

  // Check if this might be an Ethereum address (0x + 40 hex chars)
  const addressPattern = /^0x[a-fA-F0-9]{40}$/;
  if (addressPattern.test(content.trim())) {
    console.log(`Detected Ethereum address: ${content.trim()}`);
    await debugHandlers.handleKeyPackageCheck(ctx, "", content.trim());
    await showNavigationOptions(ctx, appConfig, "Key package check completed!");
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
      await showNavigationOptions(
        ctx,
        appConfig,
        "Custom load test completed!",
      );
    } else {
      await ctx.sendText(
        "❌ Invalid parameters! Please use reasonable values:\n" +
          "• Groups: 1-1000\n" +
          "• Messages: 1-1000\n\n" +
          "Example: `10 20` for 10 groups × 20 messages",
      );
      await showNavigationOptions(
        ctx,
        appConfig,
        "Please try again with valid parameters.",
      );
    }
    return;
  }

  if (ctx.isDm() && !isTagged)
    await ctx.sendText("Please send /kc to see the main menu");
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
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);

  // Debug: Log all registered actions
  console.log("🔍 Registered actions:", getRegisteredActions());
});

await agent.start();
