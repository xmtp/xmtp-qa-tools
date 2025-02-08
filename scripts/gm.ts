import { type XmtpEnv } from "@xmtp/node-sdk";
import { getXmtpClient } from "../helpers/client";

const env: XmtpEnv = "dev";

async function main() {
  const client = await getXmtpClient("bob", env);

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}?env=${env}`,
  );

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${
        message.senderInboxId
      }`,
    );

    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    console.log(`Sending "gm" response...`);
    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  }
});
