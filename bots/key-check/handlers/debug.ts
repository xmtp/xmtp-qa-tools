import { createRequire } from "node:module";
import {
  getActiveVersion,
  IdentifierKind,
  type GroupMember,
} from "version-management/client-versions";

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../../package.json");
const xmtpSdkVersion: string =
  packageJson.dependencies[
    "@xmtp/node-sdk-" + getActiveVersion().nodeBindings
  ] ?? "unknown";

export class DebugHandlers {
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  async handleHelp(ctx: any, helpText: string): Promise<void> {
    await ctx.conversation.send(helpText);
    console.log("Sent help information");
  }

  async handleGroupId(ctx: any): Promise<void> {
    await ctx.conversation.send(`Conversation ID`);
    await ctx.conversation.send(`${ctx.message.conversationId}`);
    console.log(`Sent conversation ID: ${ctx.message.conversationId}`);
  }

  async handleVersion(ctx: any): Promise<void> {
    await ctx.conversation.send(`XMTP node-sdk Version: ${xmtpSdkVersion}`);
    console.log(`Sent XMTP node-sdk version: ${xmtpSdkVersion}`);
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
}
