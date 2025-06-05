import { initializeClient } from "@bots/xmtp-handler";
import { getInboxIds, logAndSend } from "@helpers/utils";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import { TEST_CONFIGS } from "suites/mobile-perf/mobile-perf.test";

const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
): Promise<void> => {
  const content = message.content as string;
  const command = content.split(" ")[0].toLowerCase();
  const receiverInboxId = message.senderInboxId;
  // Only respond to /stress commands
  if (command !== "/stress") {
    await logAndSend(
      "Send /stress [small|medium|large] to start the stress test",
      conversation,
    );
    return;
  }
  let config = TEST_CONFIGS.medium;
  if (command.split(" ")[1] === "small") {
    config = TEST_CONFIGS.small;
  } else if (command.split(" ")[1] === "medium") {
    config = TEST_CONFIGS.medium;
  } else if (command.split(" ")[1] === "large") {
    config = TEST_CONFIGS.large;
  }

  let HELP_TEXT = `Starting:\n`;
  for (const groupConfig of config) {
    HELP_TEXT += `- Send ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} DMs from each of ${groupConfig.size} workers to you\n`;
  }
  console.warn(HELP_TEXT);

  for (const groupConfig of config) {
    console.debug(
      `Creating ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} DMs`,
    );
    for (let i = 0; i < groupConfig.count; i++) {
      const receiverInboxIds = [
        receiverInboxId,
        ...getInboxIds(groupConfig.size),
      ];
      console.debug(
        `Creating group of ${receiverInboxIds.length} members with ${groupConfig.messages} DMs`,
      );
      const group = await client.conversations.newGroup(receiverInboxIds);
      for (let j = 0; j < groupConfig.messages; j++) {
        console.debug(`Sending DM ${j + 1} of ${groupConfig.messages}`);
        await group.send(
          `Hello from group ${groupConfig.size} with ${receiverInboxIds.length} members!`,
        );
      }
    }
  }
};
// Initialize the client with the message processor
await initializeClient(processMessage, [
  {
    acceptGroups: true,
    networks: ["dev", "production"],
    welcomeMessage: " Send /stress help",
    commandPrefix: "/stress",
    allowedCommands: ["help"],
  },
]);
