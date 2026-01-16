import {
  ActionBuilder,
  initializeAppFromConfig,
  inlineActionsMiddleware,
  sendActions,
  showMenu,
  showNavigationOptions,
  type AppConfig,
  type MenuAction,
} from "@agents/utils/inline-actions/inline-actions";
import {
  Agent,
  getTestUrl,
  logDetails,
  type MessageContext,
} from "@agents/versions";
import { APP_VERSION } from "@helpers/client";
import { getSDKVersionInfo } from "@helpers/versions";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import { ActionsCodec } from "../../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../../utils/inline-actions/types/IntentContent";
import { DebugHandlers } from "./handlers/debug";
import { ForksHandlers } from "./handlers/forks";
import { GroupHandlers } from "./handlers/groups";
import { KeyPackagesHandlers } from "./handlers/keypackages";
import { LoadTestHandlers } from "./handlers/loadtest";
import { UxHandlers } from "./handlers/ux";

// Immediate synchronous log - FIRST THING that runs
console.log(
  `[RESTART] Key-check bot starting - PID: ${process.pid} at ${new Date().toISOString()}`,
);

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

// Initialize handler instances
const uxHandlers = new UxHandlers();
const forksHandlers = new ForksHandlers();
const debugHandlers = new DebugHandlers();
const groupHandlers = new GroupHandlers();
const keyPackagesHandlers = new KeyPackagesHandlers();
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
        "Hey, this is the Key-Check Bot** 🔑\n*if appears greyed out, please go back to the conversation list and open the conversation again",

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
            await keyPackagesHandlers.handleKeyPackageCheck(
              ctx,
              ctx.message.senderInboxId as string,
            );
          },
        },
        {
          id: "keycheck-inbox",
          label: "🔍 By Inbox ID",
          handler: async (ctx: MessageContext) => {
            await keyPackagesHandlers.showInboxInputMenu(ctx);
          },
        },
        {
          id: "keycheck-address",
          label: "📧 By Address",
          handler: async (ctx: MessageContext) => {
            await keyPackagesHandlers.showAddressInputMenu(ctx);
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

async function showCustomLoadTestMenu(ctx: MessageContext) {
  const customMenu = ActionBuilder.create(
    "custom-load-test-menu",
    "⚙️ Custom Load Test",
  )
    .add("back-to-main", "⬅️ Go back")
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

const agent = await Agent.createFromEnv({
  appVersion: APP_VERSION,
  dbPath: (inboxId: string) =>
    (process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".") +
    `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Handle agent-level unhandled errors
agent.on("unhandledError", (error) => {
  console.error("Key-check bot fatal error:", error);
  if (error instanceof Error) {
    console.error("Error stack:", error.stack);
  }
  console.error("Exiting process - PM2 will restart");
  process.exit(1);
});

// // Handle process-level uncaught exceptions
// process.on("uncaughtException", (error) => {
//   console.error(`[UNCAUGHT_EXCEPTION] PID: ${process.pid}`, error);
//   process.exit(1);
// });

// // Handle unhandled promise rejections
// process.on("unhandledRejection", (reason) => {
//   console.error(`[UNHANDLED_REJECTION] PID: ${process.pid}`, reason);
//   process.exit(1);
// });

// Add inline actions middleware
// Type assertion needed because AgentMiddleware is a conditional type based on active version
// The middleware is compatible but TypeScript can't verify due to version-specific types
// @ts-expect-error - AgentMiddleware types from different SDK versions are incompatible at compile time but compatible at runtime
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
  // const messageBody1 = await getMessageBody(
  //   ctx,
  //   "America/Argentina/Buenos_Aires",
  // );
  // //await ctx.sendText(messageBody1);
  const message = ctx.message;
  const content = message.content;
  const isTagged =
    content.trim().startsWith("@kc") ||
    content.trim().startsWith("/kc") ||
    content.trim().startsWith("@key-check.eth");

  if (ctx.isDm() && !isTagged) {
    const welcomeMessage = `### 👋 Welcome to Key-Check Bot isDm: ${ctx.isDm()} isTagged: ${isTagged}
  
  Please send \`/kc\` to see the main menu
  
  Or directly send:
  - 📧 An **Ethereum address** to check key packages
  - 🔑 An **Inbox ID** to check key packages`;

    await ctx.conversation.send(welcomeMessage, ContentTypeMarkdown);
  } else if (isTagged) {
    await showMenu(ctx, appConfig, "main-menu");
    return;
  }

  // Check for inbox ID or address patterns
  const handled = await keyPackagesHandlers.handleTextMessage(
    ctx,
    content.trim(),
    appConfig,
  );
  if (handled) {
    return;
  }

  // Check if this might be custom load test parameters (groups messages)
  const customLoadTestPattern = /^(\d+)\s+(\d+)$/;
  const customMatch = content.trim().match(customLoadTestPattern as RegExp);
  if (customMatch) {
    const groups = parseInt(customMatch[1] as string);
    const messages = parseInt(customMatch[2] as string);
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
});

// 4. Log when we're ready
agent.on("start", async () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  logDetails(agent).catch(console.error);
  await getSDKVersionInfo(agent, agent.client);
});

await agent.start({});
