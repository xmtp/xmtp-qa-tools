import { Message, createAgent } from "@xmtp/agent-starter";

async function main() {
  const agent = await createAgent({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message?.content.text} by ${message.sender.address}`,
      );
      await agent.send({
        message: "gm",
        originalMessage: message,
      });
    },
  });

  console.log("Agent is up and running...");
}

main().catch(console.error);
