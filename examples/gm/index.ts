import { ContentTypeText } from "@xmtp/content-type-text";
import { Client, type Signer } from "@xmtp/node-sdk";

const signer: Signer = {
  getAddress: () => "0x0000000000000000000000000000000000000000",
  signMessage: () => Promise.resolve(new Uint8Array()),
};

async function main() {
  console.log("Creating client...");
  const client = await Client.create(signer, new Uint8Array());

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}`,
  );

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    if (
      !message ||
      !message.contentType ||
      !ContentTypeText.sameAs(message.contentType)
    ) {
      console.log("Invalid message, skipping", message);
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
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
    console.log("Done");
  }
}

main().catch(console.error);
