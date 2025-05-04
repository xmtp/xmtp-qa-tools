import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeClient } from "./xmtp-handler";

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
) => {
  console.log(`Sending "gm" response...`);
  console.log(isDm);
  await conversation.send("gm");
};
const main = async () => {
  await initializeClient(processMessage, { acceptGroups: true });
};
main().catch(console.error);
