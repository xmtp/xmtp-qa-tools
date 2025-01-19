## GM agent

> Try XMTP using [xmtp.chat](https://xmtp.chat)

This agent replies GM

```tsx
import { Message, xmtpClient } from "@xmtp/agent-starter";

async function main() {
  const agent = await xmtpClient({
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
```
