import * as path from "path";
import { fileURLToPath } from "url";
import {
  Group,
  type Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import * as dotenv from "dotenv";
import { validateEnvironment } from "../helpers/client";
import { initializeClient, sleep } from "../helpers/xmtp-handler";
import { config } from "./groups";

// Get directory path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables directly from the current directory first
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Then use validateEnvironment for validation
const { WALLET_KEY_CSX, PUBLIC_KEY_CSX } = validateEnvironment(
  ["WALLET_KEY_CSX", "PUBLIC_KEY_CSX"],
  path.resolve(__dirname, ".env"),
);

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
    (group) => group.publicKey === client.accountIdentifier?.identifier,
  );
  if (!groupConfig) {
    console.log("No group config found for this client");
    return;
  }
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
      await conversation.send(groupConfig.messages.welcome);
      return;
    }

    // Check the message content against the secret code
    if (message.content === groupConfig.groupCode) {
      console.log(`Secret code received, adding to group`);
      let group = await client.conversations.getConversationById(
        groupConfig.groupId[envKey],
      );
      await group?.sync();
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
      } else {
        console.log(`Group not found, skipping`);
        await conversation.send(groupConfig.messages.groupNotFound);
        return;
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
    {
      walletKey: WALLET_KEY_CSX,
      networks: ["dev", "production"],
      publicKey: PUBLIC_KEY_CSX,
    },
    {
      walletKey: process.env.WALLET_KEY_GANG as string,
      networks: ["dev", "production"],
      publicKey: process.env.PUBLIC_KEY_GANG as string,
    },
  ]);
}

main().catch(console.error);
