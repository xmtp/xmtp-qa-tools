import fs from "node:fs/promises";
import path from "node:path";
import { initializeClient } from "@bots/xmtp-handler";
import { validateEnvironment } from "@helpers/tests";
import type { Client } from "@xmtp/node-sdk";

const { WALLET_KEY } = validateEnvironment(["WALLET_KEY"]);

// Logger that both logs to console and saves to file
class XmtpLogger {
  private logBuffer: string[] = [];
  private logFilePath: string;

  constructor(filename = "xmtp-info.log") {
    this.logFilePath = path.join(process.cwd(), filename);
  }

  log(...args: any[]) {
    const message = args.join(" ");
    this.logBuffer.push(message);
    console.log(message);
  }

  async save() {
    try {
      await fs.writeFile(this.logFilePath, this.logBuffer.join("\n"));
      console.log(`Log saved to ${this.logFilePath}`);
    } catch (error) {
      console.error(
        "Error saving log:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

const fetchGroupInfo = async (
  client: Client,
  groupId: string,
  logger: XmtpLogger,
) => {
  logger.log("--- GROUP INFO ---");
  logger.log("Group ID:", groupId);

  try {
    const conversation =
      await client.conversations.getConversationById(groupId);

    if (!conversation) {
      logger.log("Group not found with ID:", groupId);
      return;
    }

    logger.log("--- GROUP DETAILS ---");
    logger.log("Conversation ID:", conversation.id);

    if ("name" in conversation) {
      logger.log("Group Name:", conversation.name);
    }

    if ("description" in conversation) {
      logger.log("Group Description:", conversation.description);
    }

    // Log members information
    const members = await conversation.members();
    logger.log("--- GROUP MEMBERS ---");
    logger.log("Total Members:", members.length);

    const allInboxIds = members.map((member) => member.inboxId);

    // Get detailed information about each member
    const inboxState =
      await client.preferences.inboxStateFromInboxIds(allInboxIds);
    logger.log("--- MEMBERS DETAILS ---");

    // Process each member's state
    for (let index = 0; index < inboxState.length; index++) {
      const state = inboxState[index];
      logger.log(`Member ${index + 1}:`);
      logger.log("InboxId:", state.inboxId);

      if (state.identifiers && state.identifiers.length > 0) {
        logger.log("Identifier:", state.identifiers[0]?.identifier);
        logger.log("Identifier Kind:", state.identifiers[0]?.identifierKind);
      }

      if (state.installations && state.installations.length > 0) {
        // Count installations
        const totalInstallations = state.installations.length;
        logger.log("Total installations:", totalInstallations);

        // Retrieve installation IDs for key package status check (just the first one)
        if (totalInstallations > 0) {
          const installationId = state.installations[0].id;

          logger.log("--- KEY PACKAGE STATUS ---");
          const status = await client.getKeyPackageStatusesForInstallationIds([
            installationId,
          ]);

          // Only show the key package dates
          for (const [_, packageStatus] of Object.entries(status)) {
            if (packageStatus && "lifetime" in packageStatus) {
              const { lifetime } = packageStatus;

              if (
                lifetime &&
                "notBefore" in lifetime &&
                "notAfter" in lifetime
              ) {
                // Convert timestamps to dates
                const createdDate = new Date(
                  parseInt(String(lifetime.notBefore), 10) * 1000,
                );
                const expiryDate = new Date(
                  parseInt(String(lifetime.notAfter), 10) * 1000,
                );

                // Calculate days remaining
                const now = new Date();
                const daysRemaining = Math.ceil(
                  (expiryDate.getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24),
                );

                logger.log("Created:", createdDate.toLocaleString());
                logger.log("Expires:", expiryDate.toLocaleString());

                if (daysRemaining > 0) {
                  logger.log(`Valid for: ${daysRemaining} more days`);
                } else {
                  logger.log(`EXPIRED: ${Math.abs(daysRemaining)} days ago`);
                }
              }
            } else if (packageStatus && "validationError" in packageStatus) {
              logger.log(`Error: ${packageStatus.validationError}`);
            }
          }
        }
      }
      logger.log(""); // Add blank line between members
    }
  } catch (error) {
    console.error(
      "Error fetching group info:",
      error instanceof Error ? error.message : String(error),
    );
  }
};

const logClientInfo = (client: Client, logger: XmtpLogger) => {
  logger.log("--- CLIENT DETAILS ---");
  logger.log("Environment:", client.options?.env);
  logger.log("InboxId:", client.inboxId);
  logger.log("Account Identifier:", client.accountIdentifier?.identifier);
  logger.log(
    "Account Identifier Kind:",
    client.accountIdentifier?.identifierKind,
  );
};

const main = async () => {
  const logger = new XmtpLogger();
  logger.log("--- INITIALIZING CLIENT ---");

  try {
    // Initialize client with message handler
    const clients = await initializeClient(undefined, [
      {
        acceptGroups: true,
        walletKey: WALLET_KEY,
        networks: ["production"],
      },
    ]);

    if (clients.length === 0) {
      console.error("No clients were initialized");
      return;
    }

    const client = clients[0];
    logClientInfo(client, logger);

    // Example group ID - replace with an actual group ID if needed
    const groupId = "f5d1e6a66be58a453eb8b8c2a077ac60";
    await fetchGroupInfo(client, groupId, logger);

    // Save all logs to file
    await logger.save();
  } catch (error) {
    console.error(
      "Error in main function:",
      error instanceof Error ? error.message : String(error),
    );
  }
};

void main().catch((error: unknown) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
