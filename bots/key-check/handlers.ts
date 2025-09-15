import {
  IdentifierKind,
  type GroupMember,
} from "version-management/client-versions";

export class CommandHandlers {
  private startTime: Date;
  private xmtpSdkVersion: string;

  constructor(startTime: Date, xmtpSdkVersion: string) {
    this.startTime = startTime;
    this.xmtpSdkVersion = xmtpSdkVersion;
  }

  async handleHelp(ctx: any, helpText: string): Promise<void> {
    await ctx.conversation.send(helpText);
    console.log("Sent help information");
  }

  async handleGroupId(ctx: any): Promise<void> {
    await ctx.conversation.send(
      `Conversation ID: "${ctx.message.conversationId}"`,
    );
    console.log(`Sent conversation ID: ${ctx.message.conversationId}`);
  }

  async handleVersion(ctx: any): Promise<void> {
    await ctx.conversation.send(
      `XMTP node-sdk Version: ${this.xmtpSdkVersion}`,
    );
    console.log(`Sent XMTP node-sdk version: ${this.xmtpSdkVersion}`);
  }

  async handleUptime(ctx: any): Promise<void> {
    const currentTime = new Date();
    const uptimeMs = currentTime.getTime() - this.startTime.getTime();

    // Convert milliseconds to days, hours, minutes, seconds
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    const uptimeText =
      `Bot started at: ${this.startTime.toLocaleString()}\n` +
      `Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`;

    await ctx.conversation.send(uptimeText);
    console.log(`Sent uptime information: ${uptimeText}`);
  }

  async handleDebug(ctx: any): Promise<void> {
    let conversations = await ctx.client.conversations.list();
    // Print the list of conversations ids to console:
    console.log(
      "Conversations:",
      conversations.map((conversation: any) => conversation.id),
    );
    await ctx.conversation.send(
      `key-check conversations: \n${conversations.map((conversation: any) => conversation.id).join("\n")}`,
    );
  }

  async handleMembers(ctx: any): Promise<void> {
    const members: GroupMember[] = await ctx.conversation.members();

    if (!members || members.length === 0) {
      await ctx.conversation.send("No members found in this conversation.");
      console.log("No members found in the conversation");
      return;
    }

    let membersList = "Group members:\n\n";

    for (const member of members) {
      const isBot =
        member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase();
      let marker = isBot ? "~" : " ";
      const isSender =
        member.inboxId.toLowerCase() ===
        ctx.message.senderInboxId.toLowerCase();
      marker = isSender ? "*" : marker;
      membersList += `${marker}${member.inboxId}${marker}\n\n`;
    }

    membersList += "\n ~indicates key-check bot's inbox ID~";
    membersList += "\n *indicates who prompted the key-check command*";

    await ctx.conversation.send(membersList);
    console.log(`Sent list of ${members.length} members`);
  }

  async handleKeyPackageCheck(
    ctx: any,
    targetInboxId: string,
    targetAddress?: string,
  ): Promise<void> {
    let resolvedInboxId = targetInboxId;

    // If we have an address, resolve it to inbox ID
    if (targetAddress) {
      try {
        const inboxId = await ctx.client.getInboxIdByIdentifier({
          identifier: targetAddress,
          identifierKind: IdentifierKind.Ethereum,
        });
        if (!inboxId) {
          await ctx.conversation.send(
            `No inbox found for address ${targetAddress}`,
          );
          return;
        }
        resolvedInboxId = inboxId;
      } catch (error) {
        console.error(`Error resolving address ${targetAddress}:`, error);
        await ctx.conversation.send(`Error resolving address ${targetAddress}`);
        return;
      }
    }

    // Get inbox state for the target inbox ID
    try {
      const inboxState = await ctx.client.preferences.inboxStateFromInboxIds(
        [resolvedInboxId],
        true,
      );

      if (!inboxState || inboxState.length === 0) {
        await ctx.conversation.send(
          `No inbox state found for ${resolvedInboxId}`,
        );
        return;
      }

      const addressFromInboxId = inboxState[0].identifiers[0].identifier;

      // Retrieve all the installation ids for the target
      const installationIds = inboxState[0].installations.map(
        (installation: { id: string }) => installation.id,
      );

      // Retrieve a map of installation id to KeyPackageStatus
      const status = (await ctx.client.getKeyPackageStatusesForInstallationIds(
        installationIds,
      )) as Record<string, any>;
      console.log(status);

      // Count valid and invalid installations
      const totalInstallations = Object.keys(status).length;
      const validInstallations = Object.values(status).filter(
        (value) => !value?.validationError,
      ).length;
      const invalidInstallations = totalInstallations - validInstallations;

      // Create and send a human-readable summary with abbreviated IDs
      let summaryText = `InboxID: \n"${resolvedInboxId}" \nAddress: \n"${addressFromInboxId}" \n You have ${totalInstallations} installations, ${validInstallations} of them are valid and ${invalidInstallations} of them are invalid.\n\n`;

      for (const [installationId, installationStatus] of Object.entries(
        status,
      )) {
        // Abbreviate the installation ID (first 4 and last 4 characters)
        const shortId =
          installationId.length > 8
            ? `${installationId.substring(0, 4)}...${installationId.substring(installationId.length - 4)}`
            : installationId;

        if (installationStatus?.lifetime) {
          const createdDate = new Date(
            Number(installationStatus.lifetime.notBefore) * 1000,
          );
          const expiryDate = new Date(
            Number(installationStatus.lifetime.notAfter) * 1000,
          );

          summaryText += `✅ '${shortId}':\n`;
          summaryText += `- created: ${createdDate.toLocaleString()}\n`;
          summaryText += `- valid until: ${expiryDate.toLocaleString()}\n\n`;
        } else if (installationStatus?.validationError) {
          summaryText += `❌ '${shortId}':\n`;
          summaryText += `- validationError: '${installationStatus.validationError}'\n\n`;
        }
      }

      await ctx.conversation.send(summaryText);
      console.log(`Sent key status for ${resolvedInboxId}`);
    } catch (error) {
      console.error(
        `Error processing key-check for ${resolvedInboxId}:`,
        error,
      );
      await ctx.conversation.send(
        `Error processing key-check: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

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
