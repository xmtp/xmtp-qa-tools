import { initializeClient } from "@helpers/xmtp-handler";
import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";

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
