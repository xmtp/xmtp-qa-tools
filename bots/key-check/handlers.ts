import { DebugHandlers } from "./handlers/debug";
import { ForksHandlers } from "./handlers/forks";
import { UxHandlers } from "./handlers/ux";

export class CommandHandlers {
  private uxHandlers: UxHandlers;
  private forksHandlers: ForksHandlers;
  private debugHandlers: DebugHandlers;

  constructor(startTime: Date, xmtpSdkVersion: string) {
    this.uxHandlers = new UxHandlers();
    this.forksHandlers = new ForksHandlers();
    this.debugHandlers = new DebugHandlers(startTime, xmtpSdkVersion);
  }

  // UX handlers delegation
  updateLastMessage(message: any): void {
    this.uxHandlers.updateLastMessage(message);
  }

  async handleUxHelp(ctx: any, uxHelpText: string): Promise<void> {
    return this.uxHandlers.handleUxHelp(ctx, uxHelpText);
  }

  async handleUxReaction(ctx: any): Promise<void> {
    return this.uxHandlers.handleUxReaction(ctx);
  }

  async handleUxReply(ctx: any): Promise<void> {
    return this.uxHandlers.handleUxReply(ctx);
  }

  async handleUxAttachment(ctx: any): Promise<void> {
    return this.uxHandlers.handleUxAttachment(ctx);
  }

  async handleUxText(ctx: any): Promise<void> {
    return this.uxHandlers.handleUxText(ctx);
  }

  async handleUxAll(ctx: any): Promise<void> {
    return this.uxHandlers.handleUxAll(ctx);
  }

  // Fork detection handlers delegation
  async handleForkDetection(ctx: any): Promise<void> {
    return this.forksHandlers.handleForkDetection(ctx);
  }

  // Debug handlers delegation
  async handleHelp(ctx: any, helpText: string): Promise<void> {
    return this.debugHandlers.handleHelp(ctx, helpText);
  }

  async handleGroupId(ctx: any): Promise<void> {
    return this.debugHandlers.handleGroupId(ctx);
  }

  async handleVersion(ctx: any): Promise<void> {
    return this.debugHandlers.handleVersion(ctx);
  }

  async handleUptime(ctx: any): Promise<void> {
    return this.debugHandlers.handleUptime(ctx);
  }

  async handleDebug(ctx: any): Promise<void> {
    return this.debugHandlers.handleDebug(ctx);
  }

  async handleMembers(ctx: any): Promise<void> {
    return this.debugHandlers.handleMembers(ctx);
  }

  async handleKeyPackageCheck(
    ctx: any,
    targetInboxId: string,
    targetAddress?: string,
  ): Promise<void> {
    return this.debugHandlers.handleKeyPackageCheck(
      ctx,
      targetInboxId,
      targetAddress,
    );
  }
}
