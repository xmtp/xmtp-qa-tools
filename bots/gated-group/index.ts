import {
  Group,
  type Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { initializeClient, sleep } from "../helpers/xmtp-handler";
import { config } from "./groups";

/**
 * Process an incoming message
 */
export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
): Promise<void> => {
  const groupConfig = config.find(
    (group) =>
      group.publicKey.toLowerCase() ===
      client.accountIdentifier?.identifier.toLowerCase(),
  );
  if (!groupConfig) {
    console.log("No group config found for this client");
    return;
  }

  try {
    const envKey = client.options?.env as XmtpEnv;
    let group = await client.conversations.getConversationById(
      groupConfig.groupId[envKey],
    );
    if (!group) {
      console.log(`Group not found, creating new group`);
      group = await client.conversations.newGroup([message.senderInboxId]);
      await group.addSuperAdmin(client.inboxId);
      await group.sync();
      await group.updateName(groupConfig.groupName);
      await conversation.send(groupConfig.messages.newGroupCreated);
      await conversation.send(
        `add this to your .env file: GROUP_ID_${envKey.toUpperCase()}_${groupConfig.id.toUpperCase()}=${group.id}`,
      );
      return;
    }
    // Get all messages from this conversation
    const messages = await conversation.messages();

    // Check if we have sent any messages in this conversation before
    const sentMessagesBefore = messages.filter(
      (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
    );
    // If we haven't sent any messages before, send a welcome message and skip validation for this message
    if (sentMessagesBefore.length === 0) {
      console.log(`Sending welcome message`);
      await conversation.send(groupConfig.messages.welcome);
      return;
    }

    // Check the message content against the secret code
    if (message.content === groupConfig.groupCode) {
      console.log(`Secret code received, adding to group`);

      await group.sync();
      if (group instanceof Group) {
        console.log(
          `Adding member ${message.senderInboxId} to group ${groupConfig.groupId[envKey]}`,
        );
        const memmbers = await group.members();
        const isMember = memmbers.some(
          (member) =>
            member.inboxId.toLowerCase() ===
            message.senderInboxId.toLowerCase(),
        );
        if (!isMember) {
          await group.addMembers([message.senderInboxId]);

          for (const successMessage of groupConfig.messages.success) {
            await conversation.send(successMessage);
            await sleep(500);
          }
        } else {
          console.log(
            `Member ${message.senderInboxId} already in group ${groupConfig.groupId[envKey]}`,
          );
          await conversation.send(groupConfig.messages.alreadyInGroup);
          return;
        }
      }
    } else {
      await conversation.send(groupConfig.messages.invalid);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing message:`, errorMessage);
    // Let the user know something went wrong
    await conversation.send(groupConfig.messages.error);
  }
  return;
};

async function main() {
  await initializeClient(processMessage, [
    ...config.map((group) => ({
      walletKey: group.walletKey,
      networks: group.networks,
      encryptionKey: group.encryptionKey,
      publicKey: group.publicKey,
    })),
  ]);
}

main().catch(console.error);
