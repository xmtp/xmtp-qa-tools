# @xmtp/agent-starter

A convenient TypeScript wrapper around [@xmtp/node-sdk](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk) simplifying agent delopment.

## Install

```bash [yarn]
yarn add @xmtp/agent-starter
```

> See the available [types](https://github.com/ephemeraHQ/xmtp-agents/blob/main/packages/agent-starter/src/lib/types.ts)

## Overview

These are the steps to initialize the XMTP listener and send messages.

- `ENCRYPTION_KEY`: The private key of the wallet that will be used to send or receive messages.

```tsx
async function main() {
  const agent = await xmtpClient({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message.content.text} by ${message.sender.address}`,
      );

      // Your AI model response
      const response = await api("Hi, how are you?");

      //Send text message
      await agent.send({
        message: response,
        originalMessage: message,
      });
    },
  });

  console.log("Agent is up and running...");
}

main().catch(console.error);
```

#### Address availability

Returns `true` if an address has XMTP enabled

```typescript
const isOnXMTP = await agent.canMessage(address);
```

## Groups

To learn more about groups, read the [XMTP documentation](https://docs.agent.org/inboxes/group-permissions).

> [!NOTE]
> You need to **add the agent to the group as a member**.

To create a group from your agent, you can use the following code:

```tsx
const group = await agent?.conversations.newGroup([address1, address2]);
```

As an admin you can add members to the group.

```tsx
// get the group
await group.sync();
//By address
await group.addMembers([0xaddresses]);
```

## Encryption keys

- `ENCRYPTION_KEY`: XMTP encryption keys can be managed in several ways. Here are the most common methods:

  1. Use an environment variable to provide the private key:

     - Store your private key in a `.env` file:
       `ENCRYPTION_KEY=0xYOUR_PRIVATE_KEY`

     ```tsx
     const agent = await xmtpClient({
       encryptionKey: process.env.ENCRYPTION_KEY,
     });
     ```

2. Generate the private key at runtime:

   - If no private key is provided, the agent can automatically generate a new one upon startup:
     `ENCRYPTION_KEY=random_key`
   - If exists in the .env file it will **not** generated a new key.
   - This method will save the key in the `.env` file for future use.

     ```tsx
     const agent = await xmtpClient({});
     ```

3. Assign a name (alias) to the randomly generated key:

   - Providing a "name" gives your key a meaningful identifier, aiding in organization and persistence.
     `ENCRYPTION_KEY_agentA=0xYOUR_PRIVATE_KEY`
   - This method will also save the key in the `.env` file for future use.

     ```tsx
     const agent = await xmtpClient({
       name: "_agentA", // Optional alias for this agent's key
     });
     ```

- `FIXED_KEY`: The fixed key is an additional security measure. It is not linked to the public address and can be randomly generated or shared across different agents. It will also be generated and saved in the `.env` file using the methods described above.

## Receive messages

After passing the onMessage handler to your agent, the agent will start listening to incoming messages sent via the XMTP network. These messages can be of various different types explained below.

```tsx
const onMessage = async (message: Message) => {
  console.log(
    `Decoded message: ${message.content.text} by ${message.sender.address}`,
  );
  let typeId = message.typeId;

  if (typeId === "text") {
    // Do something with the text
  } else if (typeId === "reaction") {
    // Do something with the reaction
  } else if (typeId === "reply") {
    // Do something with the `reply`
  } else if (typeId === "attachment") {
    // Do something with the attachment data url
  } else if (typeId === "agent_message") {
    // Do something with the agent message
  } else if (typeId === "group_updated") {
    // Do something with the group updated metadata
  }
};
```

## Content types

`agent-starter` provides an abstraction to XMTP [content types](https://github.com/xmtp/xmtp-js/tree/main/content-types) to make it easier for devs to integrate different types of messages.

### Text

> See [text content type](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-reaction) for reference

```tsx
let textMessage: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
};
await agent.send(textMessage);
```

### Reaction

> See [reaction content type](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-text) for reference

```tsx
let reaction: agentMessage = {
  message: "😅",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "reaction",
};
await agent.send(reaction);
```

### Reply

> See [reply content type](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-reply) for reference

```tsx
let reply: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "reply",
};
await agent.send(reply);
```

### Attachment

> See [attachment content type](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-attachment) for reference

```tsx
let attachment: agentMessage = {
  message: "https://picsum.photos/200/300",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "attachment",
};
await agent.send(attachment);
```

### Agent

> See [agent content type](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-reaction) for reference

```tsx
let agentMessage: agentMessage = {
  message: "Would you like to approve this transaction?",
  metadata: {
    amount: "10",
    token: "USDC",
    chain: "base",
    destinationAddress: "0x123...789",
  },
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "agent_message",
};
await agent.send(agentMessage);
```

> **Open for feedback**  
> You are welcome to provide feedback on this implementation by commenting on the [Proposal for content type](https://community.xmtp.org/).
