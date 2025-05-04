import * as path from "path";
import { initializeClient, sleep } from "@helpers/xmtp-handler";
import {
  Group,
  type Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { config } from "./groups";

// Load environment variables from the current directory first
dotenv.config({ path: path.resolve(".env") });

/**
 * Process an incoming message
 */
export const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
): Promise<void> => {
  const envKey = client.options?.env as XmtpEnv;
  try {
    // Get all messages from this conversation
    const messages = await conversation.messages();

    // Check if we have sent any messages in this conversation before
    const sentMessagesBefore = messages.filter(
      (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
    );
    // If we haven't sent any messages before, send a welcome message and skip validation for this message
    if (sentMessagesBefore.length === 0) {
      console.log(`Sending welcome message`);
      await conversation.send(config.messages.welcome);
      return;
    }

    // Check the message content against the secret code
    if (message.content === config.groupCode) {
      console.log(`Secret code received, adding to group`);
      let group = await client.conversations.getConversationById(
        config.groupId[envKey],
      );
      await group?.sync();
      if (group instanceof Group) {
        console.log(
          `Adding member ${message.senderInboxId} to group ${config.groupId[envKey]}`,
        );
        const memmbers = await group.members();
        const isMember = memmbers.some(
          (member) =>
            member.inboxId.toLowerCase() ===
            message.senderInboxId.toLowerCase(),
        );
        if (!isMember) {
          await group.addMembers([message.senderInboxId]);

          for (const successMessage of config.messages.success) {
            await conversation.send(successMessage);
            await sleep(500);
          }
        } else {
          console.log(
            `Member ${message.senderInboxId} already in group ${config.groupId[envKey]}`,
          );
          await conversation.send(config.messages.alreadyInGroup);
          return;
        }
      } else {
        console.log(`Group not found, skipping`);
        await conversation.send(config.messages.groupNotFound);
        return;
      }
    } else {
      await conversation.send(config.messages.invalid);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing message:`, errorMessage);
    // Let the user know something went wrong
    await conversation.send(config.messages.error);
  }
  return;
};

async function main() {
  await initializeClient(processMessage, [
    {
      walletKey: process.env.WALLET_KEY_CSX as string,
      networks: ["dev", "production"],
    },
    {
      walletKey: process.env.WALLET_KEY_GANG as string,
      networks: ["dev", "production"],
    },
  ]);
}

main().catch(console.error);
