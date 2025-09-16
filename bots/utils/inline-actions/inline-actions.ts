import type { AgentMiddleware, MessageContext } from "@xmtp/agent-sdk";
import {
  ContentTypeActions,
  type Action,
  type ActionsContent,
} from "./types/ActionsContent";
import { type IntentContent } from "./types/IntentContent";

// Core types
export type ActionHandler = (ctx: MessageContext) => Promise<void>;

// Action registry
const actionHandlers = new Map<string, ActionHandler>();

export function registerAction(actionId: string, handler: ActionHandler): void {
  actionHandlers.set(actionId, handler);
}

// Middleware
export const inlineActionsMiddleware: AgentMiddleware = async (ctx, next) => {
  if (ctx.message.contentType?.typeId === "intent") {
    const intentContent = ctx.message.content as IntentContent;
    const handler = actionHandlers.get(intentContent.actionId);

    console.log("🎯 Processing intent:", intentContent.actionId);

    if (handler) {
      try {
        await handler(ctx);
      } catch (error) {
        console.error(`❌ Error in action handler:`, error);
        await ctx.conversation.send(
          `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      await ctx.conversation.send(
        `❌ Unknown action: ${intentContent.actionId}`,
      );
    }
    return;
  }
  await next();
};

// Builder for creating actions
export class ActionBuilder {
  private actions: Action[] = [];
  private actionId = "";
  private actionDescription = "";

  static create(id: string, description: string): ActionBuilder {
    const builder = new ActionBuilder();
    builder.actionId = id;
    builder.actionDescription = description;
    return builder;
  }

  add(
    id: string,
    label: string,
    style?: "primary" | "secondary" | "danger",
  ): this {
    this.actions.push({ id, label, style });
    return this;
  }

  build(): ActionsContent {
    return {
      id: this.actionId,
      description: this.actionDescription,
      actions: this.actions,
    };
  }

  async send(ctx: MessageContext): Promise<void> {
    await ctx.conversation.send(this.build(), ContentTypeActions);
  }
}

// Helper functions
export async function sendActions(
  ctx: MessageContext,
  actionsContent: ActionsContent,
): Promise<void> {
  await ctx.conversation.send(actionsContent, ContentTypeActions);
}

export async function sendConfirmation(
  ctx: MessageContext,
  message: string,
  onYes: ActionHandler,
  onNo?: ActionHandler,
): Promise<void> {
  const timestamp = Date.now();
  const yesId = `yes-${timestamp}`;
  const noId = `no-${timestamp}`;

  registerAction(yesId, onYes);
  registerAction(
    noId,
    onNo ||
      (async (ctx) => {
        await ctx.conversation.send("❌ Cancelled");
      }),
  );

  await ActionBuilder.create(`confirm-${timestamp}`, message)
    .add(yesId, "✅ Yes", "primary")
    .add(noId, "❌ No", "danger")
    .send(ctx);
}

export async function sendSelection(
  ctx: MessageContext,
  message: string,
  options: Array<{
    id: string;
    label: string;
    style?: "primary" | "secondary" | "danger";
    handler: ActionHandler;
  }>,
): Promise<void> {
  const builder = ActionBuilder.create(`selection-${Date.now()}`, message);

  options.forEach((option) => {
    registerAction(option.id, option.handler);
    builder.add(option.id, option.label, option.style);
  });

  await builder.send(ctx);
}

// Validation helpers
export const validators = {
  inboxId: (input: string) => {
    const pattern = /^[a-fA-F0-9]{64}$/;
    return pattern.test(input.trim())
      ? { valid: true }
      : { valid: false, error: "Invalid Inbox ID format (64 hex chars)" };
  },

  ethereumAddress: (input: string) => {
    const pattern = /^0x[a-fA-F0-9]{40}$/;
    return pattern.test(input.trim())
      ? { valid: true }
      : {
          valid: false,
          error: "Invalid Ethereum address format (0x + 40 hex chars)",
        };
  },
};

// Common patterns
export const patterns = {
  inboxId: /^[a-fA-F0-9]{64}$/,
  ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
};

// Additional types needed by index.ts
export type MenuAction = {
  id: string;
  label: string;
  style?: "primary" | "secondary" | "danger";
  handler?: ActionHandler;
};

export type Menu = {
  id: string;
  title: string;
  actions: MenuAction[];
};

export type AppConfig = {
  name: string;
  menus: Record<string, Menu>;
};

// Utility functions needed by index.ts
export function getRegisteredActions(): string[] {
  return Array.from(actionHandlers.keys());
}

export async function showMenu(
  ctx: MessageContext,
  config: AppConfig,
  menuId: string,
): Promise<void> {
  const menu = config.menus[menuId];
  if (!menu) {
    console.error(`❌ Menu not found: ${menuId}`);
    await ctx.conversation.send(`❌ Menu not found: ${menuId}`);
    return;
  }

  const timestamp = Date.now();
  const builder = ActionBuilder.create(`${menuId}-${timestamp}`, menu.title);

  menu.actions.forEach((action) => {
    builder.add(action.id, action.label, action.style);
  });

  await builder.send(ctx);
}

export function initializeAppFromConfig(
  config: AppConfig,
  options?: {
    deferredHandlers?: Record<string, ActionHandler>;
  },
): void {
  console.log(`🚀 Initializing app: ${config.name}`);

  // Register all handlers from menu actions
  Object.values(config.menus).forEach((menu) => {
    menu.actions.forEach((action) => {
      if (action.handler) {
        registerAction(action.id, action.handler);
        console.log(`✅ Registered handler for action: ${action.id}`);
      }
    });
  });

  // Register any deferred handlers
  if (options?.deferredHandlers) {
    Object.entries(options.deferredHandlers).forEach(([actionId, handler]) => {
      registerAction(actionId, handler);
      console.log(`✅ Registered deferred handler for action: ${actionId}`);
    });
  }

  // Auto-register menu navigation actions (for actions without handlers that match menu IDs)
  Object.values(config.menus).forEach((menu) => {
    menu.actions.forEach((action) => {
      if (!action.handler && config.menus[action.id]) {
        // This action navigates to another menu
        registerAction(action.id, async (ctx: MessageContext) => {
          await showMenu(ctx, config, action.id);
        });
        console.log(`✅ Auto-registered navigation for menu: ${action.id}`);
      }
    });
  });

  // Auto-register common navigation actions
  registerAction("main-menu", async (ctx: MessageContext) => {
    await showMenu(ctx, config, "main-menu");
  });

  registerAction("help", async (ctx: MessageContext) => {
    await showMenu(ctx, config, "main-menu");
  });

  registerAction("back-to-main", async (ctx: MessageContext) => {
    await showMenu(ctx, config, "main-menu");
  });
}
