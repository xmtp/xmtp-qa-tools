# Agent starter

This library provides a wrapper around [XMTP SDK for Node](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk) to make it easier to use in your agent.

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
  const agent = await createAgent({
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

## Address availability

Returns `true` if an address has XMTP enabled

```typescript
const isOnXMTP = await agent.canMessage(address);
```

## Groups

To learn more about groups, read the [XMTP documentation](https://docs.agent.org/inboxes/group-permissions).

> [!TIP]
> You need to **add the agent to the group as a member**.

To create a group from your agent, you can use the following code:

```tsx
const group = await xmtp?.conversations.newGroup([address1, address2]);
```

As an admin you can add members to the group.

```tsx
// get the group
await group.sync();
//By address
await group.addMembers([0xaddresses]);
```

## Receive messages

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

`agent-starter` provides an abstraction to XMTP [content typs](https://github.com/xmtp/xmtp-js/tree/main/content-types) to make it easier for devs to integrate different types of messages.

### Text

```tsx
let textMessage: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
};
await agent.send(textMessage);
```

### Reaction

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

```tsx
let agentMessage: agentMessage = {
  message: "Would you like to approve this transaction?",
  metadata: {
    agentId: "payment-bot",
    skillUsed: "approve-tx",
    amount: "10",
    token: "USDC",
    chain: "base",
    destinationAddress: "0x123...789",
  },
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "agent",
};
await agent.send(agentMessage);
```
