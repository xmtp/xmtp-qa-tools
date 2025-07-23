import { getSenderAddress } from "@bots/xmtp-skills";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
  type Group,
} from "@xmtp/node-sdk";
import { initializeClient } from "../helpers/xmtp-handler";

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  console.log("=== MESSAGE RECEIVED ===");
  console.log(`Content: ${message.content as string}`);
  console.log(`Sender InboxId: ${message.senderInboxId}`);
  console.log(`Message ID: ${message.id}`);
  console.log(`Sent at: ${message.sentAt.toISOString()}`);

  // Get sender address
  const senderAddress = await getSenderAddress(client, message.senderInboxId);
  console.log(`Sender Address: ${senderAddress}`);

  // Basic conversation info
  console.log("=== CONVERSATION INFO ===");
  console.log(`Conversation ID: ${conversation.id}`);
  console.log(`Conversation Kind: ${conversation.kind}`);
  console.log(`Created at: ${conversation.createdAt.toISOString()}`);

  // Get debug info
  console.log("=== DEBUG INFO ===");
  const debugInfo = await conversation.debugInfo();
  console.log("Raw debug info:", JSON.stringify(debugInfo, null, 2));
  console.log(`Debug epoch: ${debugInfo.epoch}`);
  console.log(`Debug epoch type: ${typeof debugInfo.epoch}`);
  console.log(`Maybe forked: ${debugInfo.maybeForked}`);
  console.log(`Maybe forked type: ${typeof debugInfo.maybeForked}`);

  // Members info
  console.log("=== MEMBERS INFO ===");
  const members = await conversation.members();
  console.log(`Total members: ${members.length}`);

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    console.log(`--- Member ${i + 1} ---`);
    console.log(`InboxId: ${member.inboxId}`);
    console.log(`Installation IDs:`, member.installationIds);
    console.log(`Permission level:`, member.permissionLevel);

    try {
      const memberAddress = await getSenderAddress(client, member.inboxId);
      console.log(`Resolved address: ${memberAddress}`);
    } catch (error) {
      console.log(`Failed to resolve address:`, error);
    }
  }

  console.log("=== GROUP-SPECIFIC INFO ===");
  const group = conversation as Group;

  console.log(`Group name: ${group.name || "undefined"}`);
  console.log(`Group description: ${group.description || "undefined"}`);
  console.log(`Group image URL: ${group.imageUrl || "undefined"}`);
  console.log(`Group admins:`, group.admins);
  console.log(`Group super admins:`, group.superAdmins);
  console.log(`Is group active: ${group.isActive}`);
  console.log(`Added by inbox ID: ${group.addedByInboxId || "undefined"}`);

  // Client info
  console.log("=== CLIENT INFO ===");
  console.log(`Client inbox ID: ${client.inboxId}`);
  console.log(`Client installation ID: ${client.installationId}`);

  // Conversation state after sync
  console.log("=== POST-SYNC STATE ===");
  try {
    await conversation.sync();
    const postSyncDebugInfo = await conversation.debugInfo();
    console.log(`Post-sync epoch: ${postSyncDebugInfo.epoch}`);
    console.log(`Post-sync maybe forked: ${postSyncDebugInfo.maybeForked}`);

    if (postSyncDebugInfo.epoch !== debugInfo.epoch) {
      console.log("⚠️  EPOCH CHANGED AFTER SYNC!");
      console.log(`Original epoch: ${debugInfo.epoch}`);
      console.log(`New epoch: ${postSyncDebugInfo.epoch}`);
    }
  } catch (error) {
    console.log(`Failed to sync conversation:`, error);
  }

  // Message history info
  console.log("=== MESSAGE HISTORY ===");
  try {
    const messages = await conversation.messages();
    console.log(`Total messages in conversation: ${messages.length}`);
    if (messages.length > 0) {
      console.log(
        `First message sent at: ${messages[messages.length - 1].sentAt.toISOString()}`,
      );
      console.log(`Last message sent at: ${messages[0].sentAt.toISOString()}`);
    }
  } catch (error) {
    console.log(`Failed to get message history:`, error);
  }

  console.log("=== END OF DEBUG LOG ===\n");
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    networks: ["production"],
    acceptGroups: true,
  },
]);
