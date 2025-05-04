import { validateEnvironment } from "@bots/client";
import { initializeClient } from "@bots/xmtp-handler";
import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

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
  await initializeClient(processMessage, [
    {
      acceptGroups: true,
      walletKey: WALLET_KEY,
      encryptionKey: ENCRYPTION_KEY,
      networks: ["dev", "production"],
    },
  ]);
};
main().catch(console.error);
