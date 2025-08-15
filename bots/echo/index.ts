import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "version-management/client-versions";
import { initializeClient } from "../helpers/xmtp-handler";

let count = 0;
const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
) => {
  console.log(`${count} Received message`);

  await conversation.send(`echo: ${message.content as string}`);
  count++;
};

// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    acceptGroups: true,
  },
]);
