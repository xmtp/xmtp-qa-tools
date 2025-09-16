import type { AgentMiddleware, MessageContext } from "@xmtp/agent-sdk";
import {
  ContentTypeActions,
  type Action,
  type ActionsContent,
} from "./types/ActionsContent";
import { type IntentContent } from "./types/IntentContent";

/**
 * Action handler function type
 */
export type ActionHandler = (
  ctx: MessageContext,
  metadata?: Record<string, string | number | boolean | null>,
) => Promise<void>;

/**
 * Simplified action handler that automatically receives ctx
 */
export type SimpleActionHandler = () => Promise<void>;

/**
 * Wrapper function that automatically provides MessageContext to handlers
 */
export function withCtx(
  handler: (ctx: MessageContext) => Promise<void>,
): ActionHandler {
  return async (ctx: MessageContext) => {
    await handler(ctx);
  };
}

/**
 * Menu action definition with inline handler
 */
export type MenuAction = {
  id: string;
  label: string;
  style?: "primary" | "secondary" | "danger";
  handler?: ActionHandler;
};

/**
 * Menu definition
 */
export type Menu = {
  id: string;
  title: string;
  actions: MenuAction[];
};

/**
 * App configuration with menus and handlers directly inline
 */
export type AppConfig = {
  name: string;
  menus: Record<string, Menu>;
};

/**
 * Action registry to store action handlers
 */
class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();

  register(actionId: string, handler: ActionHandler): void {
    this.handlers.set(actionId, handler);
  }

  get(actionId: string): ActionHandler | undefined {
    return this.handlers.get(actionId);
  }

  has(actionId: string): boolean {
    return this.handlers.has(actionId);
  }

  getAll(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Global action registry instance
 */
const globalActionRegistry = new ActionRegistry();

/**
 * Inline Actions Middleware
 * Automatically handles intent messages and routes them to registered handlers
 */
export const inlineActionsMiddleware: AgentMiddleware = async (ctx, next) => {
  const message = ctx.message;

  // Check if this is an intent message
  if (message.contentType?.typeId === "intent") {
    console.log("🎯 Processing intent message via middleware");
    const intentContent = message.content as IntentContent;
    const handler = globalActionRegistry.get(intentContent.actionId);

    // Log transaction reference intent when it gets back
    console.log("🎯 Transaction Intent Received:", {
      id: intentContent.id,
      actionId: intentContent.actionId,
      timestamp: new Date().toISOString(),
      messageId: ctx.message.id,
    });

    // Simplified logging - just process the action without verbose output

    if (handler) {
      console.log(`🎯 Found handler for action: ${intentContent.actionId}`);
      try {
        await handler(ctx, undefined);
      } catch (error) {
        console.error(
          `❌ Error in action handler for ${intentContent.actionId}:`,
          error,
        );
        await ctx.conversation.send(
          `❌ Error processing action: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      console.log(
        `❌ No handler registered for action: ${intentContent.actionId}`,
      );
      await ctx.conversation.send(
        `❌ Unknown action: ${intentContent.actionId}`,
      );
    }

    // Don't continue to other handlers for intent messages
    return;
  }

  // Continue to next middleware for non-intent messages
  await next();
};

/**
 * Register an action handler
 */
export function registerAction(actionId: string, handler: ActionHandler): void {
  globalActionRegistry.register(actionId, handler);
}

/**
 * Action Builder - Fluent interface for creating actions
 */
export class ActionBuilder {
  private actions: Action[] = [];
  private actionDescription = "";
  private actionId = "";

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
    imageUrl?: string,
    expiresAt?: string,
  ): this {
    this.actions.push({
      id,
      label,
      style,
      imageUrl,
      expiresAt,
    });
    return this;
  }

  // Keep legacy methods for backward compatibility
  addAction(
    id: string,
    label: string,
    options?: {
      style?: "primary" | "secondary" | "danger";
      imageUrl?: string;
      expiresAt?: string;
    },
  ): this {
    this.actions.push({
      id,
      label,
      ...options,
    });
    return this;
  }

  build(): ActionsContent {
    return {
      id: this.actionId,
      description: this.actionDescription,
      actions: this.actions,
    };
  }
}

/**
 * Quick helper to send actions to a conversation
 */
export async function sendActions(
  ctx: MessageContext,
  actionsContent: ActionsContent,
): Promise<void> {
  await ctx.conversation.send(actionsContent, ContentTypeActions);
}

/**
 * Quick helper to create and send simple yes/no confirmation
 */
export async function sendConfirmation(
  ctx: MessageContext,
  message: string,
  yesActionId: string = "confirm-yes",
  noActionId: string = "confirm-no",
): Promise<void> {
  const actions = ActionBuilder.create(`confirmation-${Date.now()}`, message)
    .add(yesActionId, "✅ Yes")
    .add(noActionId, "❌ No")
    .build();

  await sendActions(ctx, actions);
}

/**
 * Quick helper to create and send a selection menu
 */
export async function sendSelection(
  ctx: MessageContext,
  message: string,
  options: Array<{
    id: string;
    label: string;
    style?: "primary" | "secondary" | "danger";
    imageUrl?: string;
    expiresAt?: string;
  }>,
): Promise<void> {
  const builder = ActionBuilder.create(`selection-${Date.now()}`, message);

  options.forEach((option) => {
    builder.add(
      option.id,
      option.label,
      option.style,
      option.imageUrl,
      option.expiresAt,
    );
  });

  await sendActions(ctx, builder.build());
}

/**
 * Utility to check if all required actions are registered
 */
export function validateRegisteredActions(requiredActions: string[]): {
  valid: boolean;
  missing: string[];
} {
  const missing = requiredActions.filter(
    (actionId) => !globalActionRegistry.has(actionId),
  );
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get list of all registered actions (for debugging)
 */
export function getRegisteredActions(): string[] {
  return globalActionRegistry.getAll();
}

/**
 * Fluent Menu Builder - Simplifies creating interactive menus
 */
export class MenuBuilder {
  private menu: Menu;

  constructor(id: string, title: string) {
    this.menu = {
      id,
      title,
      actions: [],
    };
  }

  static create(id: string, title: string): MenuBuilder {
    return new MenuBuilder(id, title);
  }

  /**
   * Add an action with inline handler
   */
  action(
    id: string,
    label: string,
    handler: ActionHandler,
    style?: "primary" | "secondary" | "danger",
  ): this {
    this.menu.actions.push({ id, label, style, handler });
    return this;
  }

  /**
   * Add a simple action without handler (for navigation)
   */
  nav(
    id: string,
    label: string,
    style?: "primary" | "secondary" | "danger",
  ): this {
    this.menu.actions.push({ id, label, style });
    return this;
  }

  /**
   * Add a back button
   */
  back(targetMenuId: string = "main-menu", label: string = "⬅️ Back"): this {
    this.menu.actions.push({ id: targetMenuId, label });
    return this;
  }

  /**
   * Build and auto-register all handlers
   */
  build(): Menu {
    // Auto-register handlers
    this.menu.actions.forEach((action) => {
      if (action.handler) {
        registerAction(action.id, action.handler);
      }
    });
    return this.menu;
  }

  /**
   * Build, register, and immediately show the menu
   */
  async show(ctx: MessageContext): Promise<void> {
    const menu = this.build();
    const timestamp = Date.now();
    const builder = ActionBuilder.create(`${menu.id}-${timestamp}`, menu.title);

    menu.actions.forEach((action) => {
      builder.add(action.id, action.label, action.style);
    });

    await sendActions(ctx, builder.build());
  }
}

/**
 * Navigation utilities to reduce repetitive navigation code
 */
export const NavigationHelper = {
  /**
   * Show navigation options after an action completes
   */
  async showAfterAction(
    ctx: MessageContext,
    message: string,
    options?: {
      showMainMenu?: boolean;
      showBackButton?: boolean;
      customActions?: Array<{
        id: string;
        label: string;
        style?: "primary" | "secondary" | "danger";
      }>;
    },
  ): Promise<void> {
    const {
      showMainMenu = true,
      showBackButton = false,
      customActions = [],
    } = options || {};

    const builder = MenuBuilder.create(`navigation-${Date.now()}`, message);

    // Add custom actions first
    customActions.forEach((action) => {
      builder.nav(action.id, action.label, action.style);
    });

    // Add standard navigation
    if (showBackButton) {
      builder.back();
    }
    if (showMainMenu) {
      builder.nav("main-menu", "🏠 Main Menu");
    }

    await builder.show(ctx);
  },

  /**
   * Quick helper for common "action completed" navigation
   */
  async afterAction(ctx: MessageContext, actionName: string): Promise<void> {
    await this.showAfterAction(ctx, `${actionName} completed!`);
  },
};

/**
 * Input handling utilities for common scenarios
 */
export const InputHelper = {
  /**
   * Create an input prompt with validation
   */
  async promptFor(
    ctx: MessageContext,
    config: {
      title: string;
      prompt: string;
      validator?: (input: string) => { valid: boolean; error?: string };
      examples?: string[];
      backAction?: string;
    },
  ): Promise<void> {
    const { title, prompt, examples = [], backAction = "main-menu" } = config;

    let fullPrompt = prompt;

    if (examples.length > 0) {
      fullPrompt +=
        "\n\nExamples:\n" + examples.map((ex) => `• ${ex}`).join("\n");
    }

    const builder = MenuBuilder.create(`input-${Date.now()}`, title).nav(
      backAction,
      "⬅️ Back",
    );

    await builder.show(ctx);
    await ctx.conversation.send(fullPrompt);
  },

  /**
   * Common validators
   */
  validators: {
    inboxId: (input: string) => {
      const pattern = /^[a-fA-F0-9]{64}$/;
      return pattern.test(input.trim())
        ? { valid: true }
        : {
            valid: false,
            error: "Invalid Inbox ID format (must be 64 hex characters)",
          };
    },

    ethereumAddress: (input: string) => {
      const pattern = /^0x[a-fA-F0-9]{40}$/;
      return pattern.test(input.trim())
        ? { valid: true }
        : {
            valid: false,
            error:
              "Invalid Ethereum address format (must be 0x + 40 hex characters)",
          };
    },

    positiveNumbers: (input: string) => {
      const match = input.trim().match(/^(\d+)\s+(\d+)$/);
      if (!match) {
        return {
          valid: false,
          error: "Format should be: number number (e.g., '10 20')",
        };
      }
      const [, num1, num2] = match;
      const n1 = parseInt(num1);
      const n2 = parseInt(num2);
      if (n1 <= 0 || n2 <= 0 || n1 > 1000 || n2 > 1000) {
        return { valid: false, error: "Numbers must be between 1-1000" };
      }
      return { valid: true };
    },
  },

  /**
   * Common regex patterns for text matching
   */
  patterns: {
    inboxId: /^[a-fA-F0-9]{64}$/,
    ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
    positiveNumbers: /^(\d+)\s+(\d+)$/,
  },
};

/**
 * Quick confirmation patterns
 */
export const ConfirmationHelper = {
  /**
   * Show a yes/no confirmation dialog
   */
  async confirm(
    ctx: MessageContext,
    message: string,
    onYes: ActionHandler,
    onNo?: ActionHandler,
  ): Promise<void> {
    const timestamp = Date.now();
    const yesId = `confirm-yes-${timestamp}`;
    const noId = `confirm-no-${timestamp}`;

    // Register handlers
    registerAction(yesId, onYes);
    if (onNo) {
      registerAction(noId, onNo);
    } else {
      registerAction(noId, async (ctx) => {
        await ctx.conversation.send("❌ Cancelled");
        await NavigationHelper.afterAction(ctx, "Action cancelled");
      });
    }

    const builder = MenuBuilder.create(`confirmation-${timestamp}`, message)
      .nav(yesId, "✅ Yes", "primary")
      .nav(noId, "❌ No", "danger");

    await builder.show(ctx);
  },

  /**
   * Show a dangerous action confirmation
   */
  async confirmDangerous(
    ctx: MessageContext,
    message: string,
    warningText: string,
    onConfirm: ActionHandler,
  ): Promise<void> {
    await ctx.conversation.send(`⚠️ ${warningText}`);
    await this.confirm(ctx, message, onConfirm);
  },
};

/**
 * Simplified App class that ties everything together
 */
export class InlineActionsApp {
  private menus: Map<string, Menu> = new Map();
  private textHandlers: Array<{
    pattern: RegExp | string;
    handler: ActionHandler;
  }> = [];

  constructor(public name: string) {}

  /**
   * Add a menu to the app
   */
  addMenu(menu: Menu): this {
    this.menus.set(menu.id, menu);
    return this;
  }

  /**
   * Add a text pattern handler
   */
  onText(pattern: RegExp | string, handler: ActionHandler): this {
    this.textHandlers.push({ pattern, handler });
    return this;
  }

  /**
   * Initialize the app - registers all handlers
   */
  init(): void {
    console.log(`🚀 Initializing ${this.name}`);

    // Register menu handlers
    this.menus.forEach((menu) => {
      menu.actions.forEach((action) => {
        if (action.handler) {
          registerAction(action.id, action.handler);
          console.log(`✅ Registered handler for action: ${action.id}`);
        }
      });
    });

    // Auto-register common navigation actions
    registerAction("main-menu", async (ctx: MessageContext) => {
      await this.showMenu(ctx, "main-menu");
    });

    registerAction("help", async (ctx: MessageContext) => {
      await this.showMenu(ctx, "main-menu");
    });

    registerAction("back-to-main", async (ctx: MessageContext) => {
      await this.showMenu(ctx, "main-menu");
    });

    // Auto-register menu navigation for all menus
    this.menus.forEach((menu) => {
      if (!globalActionRegistry.has(menu.id)) {
        registerAction(menu.id, async (ctx: MessageContext) => {
          await this.showMenu(ctx, menu.id);
        });
      }
    });

    // Auto-register navigation actions that point to other menus
    this.menus.forEach((menu) => {
      menu.actions.forEach((action) => {
        if (!action.handler && this.menus.has(action.id)) {
          // This action navigates to another menu
          registerAction(action.id, async (ctx: MessageContext) => {
            await this.showMenu(ctx, action.id);
          });
          console.log(`✅ Auto-registered navigation for menu: ${action.id}`);
        }
      });
    });
  }

  /**
   * Handle text messages
   */
  async handleText(ctx: MessageContext): Promise<boolean> {
    const content = String(ctx.message.content).trim();

    for (const { pattern, handler } of this.textHandlers) {
      let matches = false;

      if (typeof pattern === "string") {
        matches = content.toLowerCase().includes(pattern.toLowerCase());
      } else {
        matches = pattern.test(content);
      }

      if (matches) {
        await handler(ctx);
        return true;
      }
    }

    return false;
  }

  /**
   * Show a specific menu
   */
  async showMenu(ctx: MessageContext, menuId: string): Promise<void> {
    const menu = this.menus.get(menuId);
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

    await sendActions(ctx, builder.build());
  }
}

/**
 * Initialize app from config - registers all handlers from menus
 */
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

/**
 * Show a menu from the app config
 */
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

  await sendActions(ctx, builder.build());
}
