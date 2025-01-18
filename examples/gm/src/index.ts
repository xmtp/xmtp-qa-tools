import { Message, runAgent } from "@xmtp/agent-starter";

async function main() {
  const agent = await runAgent({
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

  console.log(
    `XMTP agent initialized on ${agent?.address}\nSend a message on https://xmtp.chat or https://converse.xyz/dm/${agent?.address}`,
  );
}

main().catch(console.error);
