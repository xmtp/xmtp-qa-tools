export class ForksHandlers {
  async handleForkDetection(ctx: any): Promise<void> {
    const message = ctx.message;
    const client = ctx.client;
    const conversation = ctx.conversation;

    try {
      console.log("=== FORK DETECTION DEBUG START ===");

      // Get sender address
      const senderAddress = await ctx.getSenderAddress();

      // Get conversation debug info
      const debugInfo = await conversation.debugInfo();
      const members = await conversation.members();
      const group = conversation;

      let debugReport = "🔍 **Fork Detection Report**\n\n";

      // Message info
      debugReport += "**📩 Message Info:**\n";
      debugReport += `• Content: ${message.content as string}\n`;
      debugReport += `• Sender: ${senderAddress}\n`;
      debugReport += `• Message ID: ${message.id}\n`;
      debugReport += `• Sent: ${message.sentAt.toISOString()}\n\n`;

      // Conversation info
      debugReport += "**💬 Conversation Info:**\n";
      debugReport += `• Conversation ID: ${conversation.id}\n`;
      debugReport += `• Created: ${conversation.createdAt.toISOString()}\n`;
      debugReport += `• Epoch: ${debugInfo.epoch}\n`;
      debugReport += `• Maybe Forked: ${debugInfo.maybeForked ? "⚠️ YES" : "✅ NO"}\n\n`;

      // Members info
      debugReport += "**👥 Members Info:**\n";
      debugReport += `• Total members: ${members.length}\n`;
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const memberAddress = await ctx.getSenderAddress();

        debugReport += `• Member ${i + 1}: ${memberAddress}\n`;
        debugReport += `  - InboxId: ${member.inboxId}\n`;
        debugReport += `  - Installations: ${member.installationIds.length}\n`;
        debugReport += `  - Permission: ${member.permissionLevel}\n`;
      }
      debugReport += "\n";

      // Group info (if applicable)
      if (group.name || group.description || group.imageUrl) {
        debugReport += "**🏷️ Group Info:**\n";
        debugReport += `• Name: ${group.name || "undefined"}\n`;
        debugReport += `• Description: ${group.description || "undefined"}\n`;
        debugReport += `• Image: ${group.imageUrl || "undefined"}\n`;
        debugReport += `• Admins: ${group.admins || "undefined"}\n`;
        debugReport += `• Super Admins: ${group.superAdmins || "undefined"}\n`;
        debugReport += `• Active: ${group.isActive}\n`;
        debugReport += `• Added By: ${group.addedByInboxId || "undefined"}\n\n`;
      }

      // Client info
      debugReport += "**🔧 Client Info:**\n";
      debugReport += `• InboxId: ${client.inboxId}\n`;
      debugReport += `• InstallationId: ${client.installationId}\n\n`;

      await ctx.conversation.send(debugReport);

      // Post-sync state check
      debugReport = "**🔄 Post-Sync Analysis:**\n";
      try {
        await conversation.sync();
        const postSyncDebugInfo = await conversation.debugInfo();
        debugReport += `• Post-sync Epoch: ${postSyncDebugInfo.epoch}\n`;
        debugReport += `• Post-sync Maybe Forked: ${postSyncDebugInfo.maybeForked ? "⚠️ YES" : "✅ NO"}\n`;

        if (postSyncDebugInfo.epoch !== debugInfo.epoch) {
          debugReport += `• ⚠️ **EPOCH CHANGED**: ${debugInfo.epoch} → ${postSyncDebugInfo.epoch}\n`;
          console.log(
            `⚠️ EPOCH CHANGED: ${debugInfo.epoch} → ${postSyncDebugInfo.epoch}`,
          );
        } else {
          debugReport += `• ✅ Epoch stable: ${debugInfo.epoch}\n`;
        }
      } catch (error) {
        debugReport += `• ❌ Failed to sync conversation: ${error instanceof Error ? error.message : "Unknown error"}\n`;
        console.log(`Failed to sync conversation:`, error);
      }
      debugReport += "\n";

      // Message history analysis
      debugReport += "**📚 Message History:**\n";
      try {
        const messages = await conversation.messages();
        debugReport += `• Total messages: ${messages.length}\n`;
        if (messages.length > 0) {
          debugReport += `• First message: ${messages[messages.length - 1].sentAt.toISOString()}\n`;
          debugReport += `• Last message: ${messages[0].sentAt.toISOString()}\n`;
        }
      } catch (error) {
        debugReport += `• ❌ Failed to get message history: ${error instanceof Error ? error.message : "Unknown error"}\n`;
        console.log(`Failed to get message history:`, error);
      }

      // Fork detection summary
      debugReport += "\n**🚨 Fork Detection Summary:**\n";
      if (debugInfo.maybeForked) {
        debugReport += "⚠️ **POTENTIAL FORK DETECTED**\n";
        debugReport += "This conversation may have experienced a fork.\n";
        debugReport += "Check epoch changes and member consistency.\n";
      } else {
        debugReport += "✅ **NO FORK DETECTED**\n";
        debugReport += "Conversation appears to be in a consistent state.\n";
      }

      await ctx.conversation.send(debugReport);

      console.log("=== FORK DETECTION DEBUG END ===");
    } catch (error) {
      console.error("Error in fork detection:", error);
      await ctx.conversation.send(
        `❌ Error during fork detection: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
