import { getInboxIds, logAndSend } from "@helpers/utils";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import { initializeClient } from "../helpers/xmtp-handler";

export const TEST_CONFIGS: Record<
  string,
  { size: number; count: number; messages: number }[]
> = {
  small: [
    { size: 2, count: 5, messages: 10 },
    { size: 10, count: 5, messages: 20 },
    { size: 50, count: 5, messages: 50 },
  ],
  medium: [
    { size: 2, count: 10, messages: 10 },
    { size: 10, count: 10, messages: 10 },
    { size: 50, count: 5, messages: 10 },
    { size: 100, count: 10, messages: 20 },
    { size: 150, count: 15, messages: 20 },
  ],
  large: [
    { size: 2, count: 30, messages: 10 },
    { size: 10, count: 20, messages: 10 },
    { size: 50, count: 10, messages: 10 },
    { size: 100, count: 10, messages: 20 },
    { size: 150, count: 15, messages: 20 },
    { size: 200, count: 15, messages: 100 },
  ],
  xl: [
    { size: 2, count: 200, messages: 20 },
    { size: 10, count: 200, messages: 20 },
  ],
};

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
        ...getInboxIds(2, groupConfig.size),
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
  },
]);
