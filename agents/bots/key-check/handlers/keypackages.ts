import {
  ActionBuilder,
  sendActions,
  showNavigationOptions,
  type AppConfig,
} from "@agents/utils/inline-actions/inline-actions";
import { type MessageContext } from "@agents/versions";
import { DebugHandlers } from "./debug";

export class KeyPackagesHandlers {
  private debugHandlers: DebugHandlers;

  constructor(debugHandlers: DebugHandlers) {
    this.debugHandlers = debugHandlers;
  }

  async showInboxInputMenu(ctx: MessageContext): Promise<void> {
    const inputMenu = ActionBuilder.create(
      "inbox-input-menu",
      "🔍 Check by Inbox ID",
    )
      .add("back-to-main", "⬅️ Go back")
      .build();

    await sendActions(ctx, inputMenu);
    await ctx.sendText(
      "Please send the Inbox ID (64 hex characters) you want to check as a regular text message.",
    );
  }

  async showAddressInputMenu(ctx: MessageContext): Promise<void> {
    const inputMenu = ActionBuilder.create(
      "address-input-menu",
      "📧 Check by Address",
    )
      .add("back-to-main", "⬅️ Go back")
      .build();

    await sendActions(ctx, inputMenu);
    await ctx.sendText(
      "Please send the Ethereum address (0x + 40 hex characters) you want to check as a regular text message.",
    );
  }

  async handleTextMessage(
    ctx: MessageContext,
    content: string,
    appConfig: AppConfig,
  ): Promise<boolean> {
    // Check if this might be an inbox ID (64 hex chars without 0x prefix)
    const inboxIdPattern = /^[a-fA-F0-9]{64}$/;
    if (inboxIdPattern.test(content.trim())) {
      console.log(`Detected inbox ID: ${content.trim()}`);
      await this.debugHandlers.handleKeyPackageCheck(
        ctx,
        content.trim() as string,
      );
      await showNavigationOptions(ctx, appConfig, "Key package check completed!");
      return true;
    }

    // Check if this might be an Ethereum address (0x + 40 hex chars)
    const addressPattern = /^0x[a-fA-F0-9]{40}$/;
    if (addressPattern.test(content.trim())) {
      console.log(`Detected Ethereum address: ${content.trim()}`);
      await this.debugHandlers.handleKeyPackageCheck(
        ctx,
        "",
        content.trim() as string,
      );
      await showNavigationOptions(ctx, appConfig, "Key package check completed!");
      return true;
    }

    return false;
  }
}
