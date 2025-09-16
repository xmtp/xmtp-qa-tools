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
