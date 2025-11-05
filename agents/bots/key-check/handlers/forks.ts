import { type AgentGroupType, type MessageContext } from "@helpers/versions";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";

interface ForkDebugInfo {
  epoch: bigint;
  maybeForked: boolean;
  timestamp: Date;
}

interface ForkAnalysisResult {
  isForkDetected: boolean;
  epochChanged: boolean;
  preSyncEpoch: bigint;
  postSyncEpoch: bigint;
  memberCount: number;
  messageCount: number;
  timeSinceLastMessage: number | null;
  syncErrors: string[];
}

export class ForksHandlers {
  private logSection(header: string): void {
    console.log("\n" + "=".repeat(60));
    console.log(`🔍 FORK DEBUG: ${header}`);
    console.log("=".repeat(60));
  }

  private logInfo(message: string, data?: any): void {
    console.log(`ℹ️  ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }

  private logWarning(message: string, data?: any): void {
    console.log(`⚠️  ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }

  private logError(message: string, error?: any): void {
    console.error(`❌ ${message}`, error);
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  private calculateTimeSinceLastMessage(messages: any[]): number | null {
    if (messages.length === 0) return null;
    const lastMessage = messages[0];
    return Date.now() - lastMessage.sentAt.getTime();
  }

  private async analyzeForkState(
    conversation: AgentGroupType,
  ): Promise<ForkAnalysisResult> {
    const syncErrors: string[] = [];
    let preSyncInfo: ForkDebugInfo | undefined;
    let postSyncInfo: ForkDebugInfo | undefined;
    let memberCount = 0;
    let messageCount = 0;
    let timeSinceLastMessage: number | null = null;

    try {
      // Get initial state
      preSyncInfo = {
        epoch: (await conversation.debugInfo()).epoch,
        maybeForked: (await conversation.debugInfo()).maybeForked,
        timestamp: new Date(),
      };

      this.logInfo(`Pre-sync state captured`, preSyncInfo);

      // Attempt sync
      await conversation.sync();
      this.logInfo("Conversation sync completed successfully");

      // Get post-sync state
      postSyncInfo = {
        epoch: (await conversation.debugInfo()).epoch,
        maybeForked: (await conversation.debugInfo()).maybeForked,
        timestamp: new Date(),
      };

      this.logInfo(`Post-sync state captured`, postSyncInfo);

      // Analyze members
      try {
        const members = await conversation.members();
        memberCount = members.length;
        this.logInfo(`Member analysis completed: ${memberCount} members`);
      } catch (error) {
        syncErrors.push(
          `Member analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        this.logError("Failed to analyze members", error);
      }

      // Analyze messages
      try {
        const messages = await conversation.messages();
        messageCount = messages.length;
        timeSinceLastMessage = this.calculateTimeSinceLastMessage(
          messages as any[],
        );
        this.logInfo(`Message analysis completed: ${messageCount} messages`);
      } catch (error) {
        syncErrors.push(
          `Message analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        this.logError("Failed to analyze messages", error);
      }
    } catch (error) {
      syncErrors.push(
        `Sync operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      this.logError("Critical sync failure", error);

      // Fallback to pre-sync info only
      postSyncInfo = preSyncInfo;
    }

    // Ensure we have valid info objects
    if (!preSyncInfo || !postSyncInfo) {
      throw new Error("Failed to capture conversation state information");
    }

    const epochChanged = preSyncInfo.epoch !== postSyncInfo.epoch;
    const isForkDetected = postSyncInfo.maybeForked || epochChanged;

    if (epochChanged) {
      this.logWarning(
        `EPOCH CHANGE DETECTED: ${preSyncInfo.epoch} → ${postSyncInfo.epoch}`,
      );
    }

    if (isForkDetected) {
      this.logWarning("FORK DETECTED - Investigation required");
    } else {
      this.logInfo("No fork detected - conversation appears stable");
    }

    return {
      isForkDetected,
      epochChanged,
      preSyncEpoch: preSyncInfo.epoch,
      postSyncEpoch: postSyncInfo.epoch,
      memberCount,
      messageCount,
      timeSinceLastMessage,
      syncErrors,
    };
  }

  private buildForkReport(
    ctx: MessageContext,
    analysis: ForkAnalysisResult,
    senderAddress: string,
  ): string {
    const message = ctx.message;
    const conversation = ctx.conversation;
    const group = conversation as AgentGroupType;

    let report = "# 🔍 FORK DETECTION ANALYSIS REPORT\n\n";

    // Critical Status Section
    report += "## 🚨 Critical Status\n\n";
    if (analysis.isForkDetected) {
      report += "⚠️ **FORK DETECTED** - Immediate attention required\n\n";
      if (analysis.epochChanged) {
        report += `🔄 Epoch changed: ${analysis.preSyncEpoch} → ${analysis.postSyncEpoch}\n\n`;
      }
    } else {
      report += "✅ **NO FORK DETECTED** - Conversation stable\n\n";
    }
    report += `📊 **Epoch:** ${analysis.postSyncEpoch}\n\n`;

    // Message Context
    report += "## 📩 Message Context\n\n";
    report += `- **Content:** "${message.content as string}"\n`;
    report += `- **Sender:** \`${senderAddress}\`\n`;
    report += `- **Message ID:** \`${message.id}\`\n`;
    report += `- **Sent:** ${this.formatTimestamp(message.sentAt as Date)}\n\n`;

    // Conversation Metadata
    report += "## 💬 Conversation Metadata\n\n";
    report += `- **ID:** \`${conversation.id}\`\n`;
    report += `- **Created:** ${this.formatTimestamp(conversation.createdAt as Date)}\n`;
    report += `- **Active:** ${group.isActive ? "✅" : "❌"}\n`;
    report += `- **Added By:** ${group.addedByInboxId || "Unknown"}\n\n`;

    // Fork Analysis Details
    report += "## 🔬 Fork Analysis Details\n\n";
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Pre-sync Epoch | ${analysis.preSyncEpoch} |\n`;
    report += `| Post-sync Epoch | ${analysis.postSyncEpoch} |\n`;
    report += `| Epoch Stability | ${analysis.epochChanged ? "⚠️ CHANGED" : "✅ STABLE"} |\n`;
    report += `| Member Count | ${analysis.memberCount} |\n`;
    report += `| Message Count | ${analysis.messageCount} |\n`;

    if (analysis.timeSinceLastMessage !== null) {
      const minutesAgo = Math.floor(
        analysis.timeSinceLastMessage / (1000 * 60),
      );
      report += `| Last Message | ${minutesAgo} minutes ago |\n`;
    }
    report += "\n";

    // Error Summary
    if (analysis.syncErrors.length > 0) {
      report += "## ❌ Sync Errors\n\n";
      analysis.syncErrors.forEach((error, index) => {
        report += `${index + 1}. ${error}\n`;
      });
      report += "\n";
    }

    // Recommendations
    report += "## 💡 Recommendations\n\n";
    if (analysis.isForkDetected) {
      report += "- Investigate epoch changes and member consistency\n";
      report += "- Check for duplicate messages or missing content\n";
      report += "- Verify all members can see the same conversation state\n";
      report += "- Consider conversation recovery procedures\n";
    } else {
      report += "- Conversation appears healthy\n";
      report += "- Continue normal operations\n";
      report += "- Monitor for future fork indicators\n";
    }

    return report;
  }

  async handleForkDetection(ctx: MessageContext): Promise<void> {
    this.logSection("FORK DETECTION START");

    try {
      const conversation = ctx.conversation as AgentGroupType;
      const senderAddress = await ctx.getSenderAddress();

      this.logInfo(`Processing fork detection request from ${senderAddress}`);
      this.logInfo(`Conversation ID: ${conversation.id}`);

      // Perform comprehensive fork analysis
      const analysis = await this.analyzeForkState(conversation);

      // Build and send detailed report
      const report = this.buildForkReport(
        ctx,
        analysis,
        senderAddress as string,
      );
      await ctx.conversation.send(report, ContentTypeMarkdown);

      this.logInfo("Fork detection report sent successfully");
      this.logSection("FORK DETECTION COMPLETE");
    } catch (error) {
      this.logError("Critical error in fork detection", error);

      const errorMessage =
        `❌ **FORK DETECTION FAILED**\n\n` +
        `Error: ${error instanceof Error ? error.message : "Unknown error"}\n\n` +
        `Please check the logs for detailed error information.`;

      await ctx.sendText(errorMessage);
    }
  }
}
