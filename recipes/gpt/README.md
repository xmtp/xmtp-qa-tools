## Create GM agent

> Try XMTP using [xmtp.chat](https://xmtp.chat)

### .env

Add the `OPENAI_API_KEY` to the .env file

```bash
KEY= # the private key of the wallet
TEST_ENCRYPTION_KEY= # a second encryption key for encryption
OPENAI_API_KEY= # sk-proj-...
```

This agent replies with the OpenAI api.

```tsx
import { Message, createAgent } from "@xmtp/agent-starter";
import OpenAI from "openai";

// Initialize OpenAI API
const openai = new OpenAI();

async function main() {
  const agent = await createAgent({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message?.content.text} by ${message.sender.address}`,
      );

      // Send message content to GPT API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "developer", content: "You are a helpful assistant." },
          {
            role: "user",
            content: message?.content.text ?? "",
          },
        ],
      });

      const gptMessage = completion.choices[0]?.message?.content?.trim();

      // Use GPT response in your application
      await agent.send({
        message: gptMessage ?? "",
        originalMessage: message,
      });
    },
  });

  console.log(
    `XMTP agent initialized on ${agent?.address}\nSend a message on https://xmtp.chat or https://converse.xyz/dm/${agent?.address}`,
  );
}

main().catch(console.error);
```
