import { getSenderAddress } from "@bots/xmtp-skills";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import { initializeClient } from "../helpers/xmtp-handler";

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  console.log(
    `Received message: ${message.content as string} by ${message.senderInboxId}`,
  );

  const senderAddress = await getSenderAddress(client, message.senderInboxId);
  await conversation.send("address");
  await conversation.send(senderAddress);
  await conversation.send("inboxId");
  await conversation.send(message.senderInboxId);
  await conversation.send("conversationId");
  await conversation.send(conversation.id);

  const members = await conversation.members();
  for (const member of members) {
    const memberAddress = await getSenderAddress(client, member.inboxId);
    console.log("member", memberAddress);
    await conversation.send(memberAddress);
  }
  console.log("Waiting for messages...");
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    walletKey: process.env.WALLET_KEY as `0x${string}`,
    dbEncryptionKey: process.env.ENCRYPTION_KEY as `0x${string}`,
    networks: ["production"],
    acceptGroups: true,
  },
]);
