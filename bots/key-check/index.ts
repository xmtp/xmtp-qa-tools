import { createRequire } from "node:module";
import {
  getActiveVersion,
  IdentifierKind,
  type Client,
  type Conversation,
  type DecodedMessage,
  type GroupMember,
} from "version-management/client-versions";
import { initializeClient } from "../xmtp-skills";

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const xmtpSdkVersion =
  packageJson.dependencies["@xmtp/node-sdk-" + getActiveVersion(1).nodeSDK];

// Track when the bot started
const startTime = new Date();

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
) => {
  // Get the message content
  const content = message.content as string;
  if (!content.trim().startsWith("/kc")) {
    return;
  }

  console.log(`Received command: ${content}`);

  // Parse the command
  const parts = content.trim().split(/\s+/);
  const command = parts.length > 1 ? parts[1] : "";

  if (command === "help") {
    // Send help information
    const helpText =
      "Available commands:\n" +
      "/kc - Check key package status for the sender\n" +
      "/kc inboxid <INBOX_ID> - Check key package status for a specific inbox ID\n" +
      "/kc address <ADDRESS> - Check key package status for a specific address\n" +
      "/kc groupid - Show the current conversation ID\n" +
      "/kc members - List all members' inbox IDs in the current conversation\n" +
      "/kc version - Show XMTP SDK version information\n" +
      "/kc uptime - Show when the bot started and how long it has been running\n" +
      "/kc debug - Show debug information for the key-check bot\n" +
      "/kc help - Show this help message";

    await conversation.send(helpText);
    console.log("Sent help information");
    return;
  }

  // Handle groupid command
  if (command === "groupid") {
    await conversation.send(`Conversation ID: "${message.conversationId}"`);
    console.log(`Sent conversation ID: ${message.conversationId}`);
    return;
  }

  // Handle version command
  if (command === "version") {
    await conversation.send(`XMTP node-sdk Version: ${xmtpSdkVersion}`);
    console.log(`Sent XMTP node-sdk version: ${xmtpSdkVersion}`);
    return;
  }

  // Handle uptime command
  if (command === "uptime") {
    const currentTime = new Date();
    const uptimeMs = currentTime.getTime() - startTime.getTime();

    // Convert milliseconds to days, hours, minutes, seconds
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);

    const uptimeText =
      `Bot started at: ${startTime.toLocaleString()}\n` +
      `Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`;

    await conversation.send(uptimeText);
    console.log(`Sent uptime information: ${uptimeText}`);
    return;
  }

  // Handle debug command
  if (command === "debug") {
    let conversations = await client.conversations.list();
    // Print the list of conversations ids to console:
    console.log(
      "Conversations:",
      conversations.map((conversation) => conversation.id),
    );
    await conversation.send(
      `key-check conversations: \n${conversations.map((conversation) => conversation.id).join("\n")}`,
    );
    return;
  }

  // Handle members command
  if (command === "members") {
    const members: GroupMember[] = await conversation.members();

    if (!members || members.length === 0) {
      await conversation.send("No members found in this conversation.");
      console.log("No members found in the conversation");
      return;
    }

    let membersList = "Group members:\n\n";

    for (const member of members) {
      const isBot =
        member.inboxId.toLowerCase() === client.inboxId.toLowerCase();
      let marker = isBot ? "~" : " ";
      const isSender =
        member.inboxId.toLowerCase() === message.senderInboxId.toLowerCase();
      marker = isSender ? "*" : marker;
      membersList += `${marker}${member.inboxId}${marker}\n\n`;
    }

    membersList += "\n ~indicates key-check bot's inbox ID~";
    membersList += "\n *indicates who prompted the key-check command*";

    await conversation.send(membersList);
    console.log(`Sent list of ${members.length} members`);
    return;
  }

  let targetInboxId = message.senderInboxId;
  let targetAddress = "";

  // Handle specific inbox ID or address lookup
  if (command === "inboxid" && parts.length > 2) {
    targetInboxId = parts[2];
    console.log(`Looking up inbox ID: ${targetInboxId}`);
  } else if (command === "address" && parts.length > 2) {
    targetAddress = parts[2];
    console.log(`Looking up address: ${targetAddress}`);

    // Need to find the inbox ID for this address
    try {
      const inboxId = await client.getInboxIdByIdentifier({
        identifier: targetAddress,
        identifierKind: IdentifierKind.Ethereum,
      });
      if (!inboxId) {
        await conversation.send(`No inbox found for address ${targetAddress}`);
        return;
      }
      targetInboxId = inboxId;
    } catch (error) {
      console.error(`Error resolving address ${targetAddress}:`, error);
      await conversation.send(`Error resolving address ${targetAddress}`);
      return;
    }
  }

  // Get inbox state for the target inbox ID
  try {
    const inboxState = await client.preferences.inboxStateFromInboxIds(
      [targetInboxId],
      true,
    );

    if (!inboxState || inboxState.length === 0) {
      await conversation.send(`No inbox state found for ${targetInboxId}`);
      return;
    }

    const addressFromInboxId = inboxState[0].identifiers[0].identifier;

    // Retrieve all the installation ids for the target
    const installationIds = inboxState[0].installations.map(
      (installation) => installation.id,
    );

    // Retrieve a map of installation id to KeyPackageStatus
    const status = (await client.getKeyPackageStatusesForInstallationIds(
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
    let summaryText = `InboxID: \n"${targetInboxId}" \nAddress: \n"${addressFromInboxId}" \n You have ${totalInstallations} installations, ${validInstallations} of them are valid and ${invalidInstallations} of them are invalid.\n\n`;
    for (const [installationId, installationStatus] of Object.entries(status)) {
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
    await conversation.send(summaryText);
    console.log(`Sent key status for ${targetInboxId}`);
  } catch (error) {
    console.error(`Error processing key-check for ${targetInboxId}:`, error);
    await conversation.send(
      `Error processing key-check: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  console.log("Waiting for messages...");
};

await initializeClient(processMessage, [
  {
    networks: ["dev", "production"],
    welcomeMessage: "Send /kc help",
    commandPrefix: "/kc",
    indexVersion: 1,
    acceptGroups: true,
  },
]);

// const siletnDebug = async (
//   client: Client,
//   conversation: Conversation,
//   message: DecodedMessage,
// ) => {
//   const senderAddress = await getSenderAddress(
//     client,
//     message.senderInboxId as string,
//   );
//   const debugInfo = await conversation.debugInfo();
//   const members = await conversation.members();
//   const group = conversation as Group;

//   console.log("=== MESSAGE RECEIVED ===");
//   console.log(
//     `Content: ${message.content as string} | Sender: ${senderAddress} | ID: ${message.id} | Sent: ${message.sentAt.toISOString()}`,
//   );
//   console.log(
//     `Conversation: ${conversation.id} | Created: ${conversation.createdAt.toISOString()}`,
//   );
//   console.log(
//     `Debug: epoch=${debugInfo.epoch}, maybeForked=${debugInfo.maybeForked}`,
//   );

//   console.log("=== MEMBERS INFO ===");
//   console.log(`Total members: ${members.length}`);
//   for (let i = 0; i < members.length; i++) {
//     const member = members[i];
//     const memberAddress = await getSenderAddress(client, member.inboxId).catch(
//       () => "Failed to resolve",
//     );
//     console.log(
//       `Member ${i + 1}: ${memberAddress} | InboxId: ${member.inboxId} | Installations: ${member.installationIds} | Permission: ${member.permissionLevel}`,
//     );
//   }

//   console.log("=== GROUP INFO ===");
//   console.log(
//     `Name: ${group.name || "undefined"} | Description: ${group.description || "undefined"} | Image: ${group.imageUrl || "undefined"}`,
//   );
//   console.log(
//     `Admins: ${group.admins} | SuperAdmins: ${group.superAdmins} | Active: ${group.isActive} | AddedBy: ${group.addedByInboxId || "undefined"}`,
//   );

//   console.log("=== CLIENT INFO ===");
//   console.log(
//     `InboxId: ${client.inboxId} | InstallationId: ${client.installationId}`,
//   );

//   console.log("=== POST-SYNC STATE ===");
//   try {
//     await conversation.sync();
//     const postSyncDebugInfo = await conversation.debugInfo();
//     console.log(
//       `Post-sync: epoch=${postSyncDebugInfo.epoch}, maybeForked=${postSyncDebugInfo.maybeForked}`,
//     );
//     if (postSyncDebugInfo.epoch !== debugInfo.epoch) {
//       console.log(
//         `⚠️  EPOCH CHANGED: ${debugInfo.epoch} → ${postSyncDebugInfo.epoch}`,
//       );
//     }
//   } catch (error) {
//     console.log(`Failed to sync conversation:`, error);
//   }

//   console.log("=== MESSAGE HISTORY ===");
//   try {
//     const messages = await conversation.messages();
//     console.log(`Total messages: ${messages.length}`);
//     if (messages.length > 0) {
//       console.log(
//         `First: ${messages[messages.length - 1].sentAt.toISOString()} | Last: ${messages[0].sentAt.toISOString()}`,
//       );
//     }
//   } catch (error) {
//     console.log(`Failed to get message history:`, error);
//   }

//   console.log("=== END OF DEBUG LOG ===\n");
// };
