import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@workers/versions";
import { initializeClient } from "../helpers/xmtp-handler";

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  console.log(
    `Received message: ${message.content as string} by ${message.senderInboxId}`,
  );

  void conversation.send(`echo: ${message.content as string}`);
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    walletKey: process.env.WALLET_KEY as `0x${string}`,
    dbEncryptionKey: process.env.ENCRYPTION_KEY as `0x${string}`,
    acceptGroups: true,
  },
]);
