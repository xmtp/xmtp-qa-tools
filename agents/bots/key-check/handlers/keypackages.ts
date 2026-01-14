import {
  ActionBuilder,
  sendActions,
  showNavigationOptions,
  type AppConfig,
} from "@agents/utils/inline-actions/inline-actions";
import { type MessageContext } from "@agents/versions";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";

export class KeyPackagesHandlers {
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
      await this.handleKeyPackageCheck(ctx, content.trim() as string);
      await showNavigationOptions(
        ctx,
        appConfig,
        "Key package check completed!",
      );
      return true;
    }

    // Check if this might be an Ethereum address (0x + 40 hex chars)
    const addressPattern = /^0x[a-fA-F0-9]{40}$/;
    if (addressPattern.test(content.trim())) {
      console.log(`Detected Ethereum address: ${content.trim()}`);
      await this.handleKeyPackageCheck(ctx, "", content.trim() as string);
      await showNavigationOptions(
        ctx,
        appConfig,
        "Key package check completed!",
      );
      return true;
    }

    return false;
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
        const inboxId = await (ctx.client as any).getInboxIdByIdentifier({
          identifier: targetAddress,
          identifierKind: 0,
        });
        if (!inboxId) {
          await ctx.sendText(`No inbox found for address ${targetAddress}`);
          return;
        }
        resolvedInboxId = inboxId;
      } catch (error) {
        console.error(`Error resolving address ${targetAddress}:`, error);
        await ctx.sendText(`Error resolving address ${targetAddress}`);
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
        await ctx.sendText(`No inbox state found for ${resolvedInboxId}`);
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

      // Create table header
      let summaryText = `## 🔑 Key Package Status

**Inbox ID:** \`${resolvedInboxId}\`  
**Address:** \`${addressFromInboxId}\`

**Summary:** ${totalInstallations} installations (✅ ${validInstallations} valid, ❌ ${invalidInstallations} invalid)

### Installation Details

| Status | Installation ID | Created | Valid Until | Error |
|--------|----------------|---------|-------------|-------|
`;

      // Add table rows
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

          summaryText += `| ✅ | \`${shortId}\` | ${createdDate.toLocaleDateString()} | ${expiryDate.toLocaleDateString()} | - |\n`;
        } else if (installationStatus?.validationError) {
          summaryText += `| ❌ | \`${shortId}\` | - | - | ${installationStatus.validationError} |\n`;
        }
      }

      await ctx.conversation.send(summaryText, ContentTypeMarkdown);
      console.log(`Sent key status for ${resolvedInboxId}`);
    } catch (error) {
      console.error(
        `Error processing key-check for ${resolvedInboxId}:`,
        error,
      );
      await ctx.sendText(
        `Error processing key-check: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
