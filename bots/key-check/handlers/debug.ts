import { createRequire } from "node:module";
import { type MessageContext } from "@xmtp/agent-sdk";
import {
  getActiveVersion,
  IdentifierKind,
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

  async handleHelp(ctx: MessageContext, helpText: string): Promise<void> {
    await ctx.conversation.send(helpText);
    console.log("Sent help information");
  }

  async handleVersion(ctx: MessageContext): Promise<void> {
    await ctx.conversation.send(`XMTP node-sdk Version: ${xmtpSdkVersion}`);
    console.log(`Sent XMTP node-sdk version: ${xmtpSdkVersion}`);
  }

  async handleUptime(ctx: MessageContext): Promise<void> {
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

  async handleDebug(ctx: MessageContext): Promise<void> {
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

  async handleDebugInfo(ctx: MessageContext): Promise<void> {
    // Get all the information from the three separate handlers
    const currentTime = new Date();
    const uptimeMs = currentTime.getTime() - this.startTime.getTime();

    // Convert milliseconds to days, hours, minutes, seconds
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    // Get conversations
    const conversations = await ctx.client.conversations.list();

    // Get client details
    const address = ctx.client.accountIdentifier?.identifier as string;
    const inboxId = ctx.client.inboxId;
    const installationId = ctx.client.installationId;
    const appVersion = ctx.client.options?.appVersion;
    const env = ctx.client.options?.env ?? "dev";

    // Get inbox state and key package info
    const inboxState = await ctx.client.preferences.inboxState();
    const keyPackageStatuses =
      await ctx.client.getKeyPackageStatusesForInstallationIds([
        installationId,
      ]);
    const keyPackageStatus = keyPackageStatuses[installationId];

    let createdDate = new Date();
    let expiryDate = new Date();
    if (keyPackageStatus?.lifetime) {
      createdDate = new Date(
        Number(keyPackageStatus.lifetime.notBefore) * 1000,
      );
      expiryDate = new Date(Number(keyPackageStatus.lifetime.notAfter) * 1000);
    }

    // Create comprehensive debug info
    const debugInfo = `🔧 **Key-Check Bot Debug Information**

📦 **Version Info:**
• XMTP SDK: ${xmtpSdkVersion}
• Client Version: ${ctx.client.constructor.name}
• App Version: ${appVersion}
• Environment: ${env}

⏰ **Uptime Info:**
• Started: ${this.startTime.toLocaleString()}
• Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s

🔑 **Client Details:**
• Address: ${address}
• Inbox ID: ${inboxId}
• Installation ID: ${installationId}
• Total Installations: ${inboxState.installations.length}
• Key Package Created: ${createdDate.toLocaleString()}
• Key Package Valid Until: ${expiryDate.toLocaleString()}

💬 **Conversations:**
• Total: ${conversations.length}
• IDs: ${conversations.map((c: any) => c.id).join(", ") || "None"}

🛠️ **System Status:**
• Bot Status: ✅ Running
• Last Updated: ${currentTime.toLocaleString()}`;

    await ctx.conversation.send(debugInfo);
    console.log("Sent comprehensive debug information");
  }

  async handleKeyPackageCheck(
    ctx: MessageContext,
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
