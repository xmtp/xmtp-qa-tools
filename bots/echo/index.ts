import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@workers/versions";
import { initializeClient } from "../helpers/xmtp-handler";

let count = 0;
const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
) => {
  console.log(`${count} Received message`);

  //void conversation.send(`echo: ${message.content as string}`);
  count++;
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    walletKey: process.env.WALLET_KEY as `0x${string}`,
    dbEncryptionKey: process.env.ENCRYPTION_KEY as `0x${string}`,
    acceptGroups: true,
  },
]);
