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

  const inboxState = await client.preferences.inboxStateFromInboxIds([
    message.senderInboxId,
  ]);
  const addressFromInboxId = inboxState[0].identifiers[0].identifier;
  console.log(`Sending "gm" response to ${addressFromInboxId}...`);
  await conversation.send("address");
  await conversation.send(addressFromInboxId);
  await conversation.send("inboxId");
  await conversation.send(message.senderInboxId);
  await conversation.send("conversationId");
  await conversation.send(conversation.id);
  await conversation.send("gm");
  console.log("Waiting for messages...");
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    networks: ["local", "dev", "production"],
  },
]);
