# Agent starter

This library provides a wrapper around [XMTP SDK for Node](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk) to make it easier to use in your agent.

## Install

```bash [yarn]
yarn add @xmtp/agent-starter
```

## Overview

These are the steps to initialize the XMTP listener and send messages.

- `ENCRYPTION_KEY`: The private key of the wallet that will be used to send or receive messages.

```tsx
async function main() {
  const agent = await createAgent({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
      const onMessage = async (message, user) => {
        console.log(`Decoded message: ${message.content.text} by ${user.address}`);

        // Your AI model response
        const response = await api("Hi, how are you?");

        //Send text message
        await xmtp.send({
          message: response,
          originalMessage: message,
        });
      };
  });

  console.log("Agent is up and running...");
}

main().catch(console.error);
```

## Address availability

Returns `true` if an address has XMTP enabled

```typescript
const isOnXMTP = await xmtp.canMessage(address);
```

## Groups

To learn more about groups, read the [XMTP documentation](https://docs.xmtp.org/inboxes/group-permissions).

:::info
You need to **add the agent to the group as a member**.
:::

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
const onMessage = async (message, user) => {
  console.log(`Decoded message: ${message.content.text} by ${user.address}`);
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

## Send messages

App messages are messages that are sent when you send a reply to a message and are highlighted differently by the apps.

:::code-group

```tsx [Text]
let textMessage: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
};
await xmtp.send(textMessage);
```

```tsx [Reaction]
let reaction: agentMessage = {
  message: "😅",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "reaction",
};
await xmtp.send(reaction);
```

```tsx [Reply]
let reply: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "reply",
};
await xmtp.send(reply);
```

```tsx [Attachment]
let attachment: agentMessage = {
  message: "https://picsum.photos/200/300",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
  typeId: "attachment",
};
await xmtp.send(attachment);
```

```tsx [Agent]
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
await xmtp.send(agentMessage);
```

:::

# Resolver library

The resolver library provides tools for resolving identities to EVM addresses and keeping track of them in a cache

## Quick start

```typescript
import { getUserInfo } from "@xmtp/agent-starter";

// Because user identifiers come in all shapes and sizes!
const identifier = "vitalik.eth"; // Could also be "0x123...", "@fabri", or even a website
const userInfo = await getUserInfo(identifier);

console.log(userInfo);
/*
{
  ensDomain: 'vitalik.eth',
  address: '0x1234...',
  preferredName: 'vitalik.eth',
  converseUsername: '',
  avatar: 'https://...',
  converseEndpoint: ''
}
*/
```

## Supported identifiers

- **Ethereum Addresses** : Example: `0x1234...`
- **ENS Domains** : Example: `vitalik.eth`
- **Converse Usernames** : Example: `@fabri`
- **Inbox ID** : Example: `0x1234...` (Converse inbox ID)
- **Website Header Tag** : Example: `https://example.com` containing `xmtp=0x1234...`
- **Website TXT Record** : Example: `meta="@xmtp/agent-starter" content="0x1234..."`

### Returned UserInfo

The resolver always returns a `UserInfo` object with these fields:

| Field                | Description                                |
| -------------------- | ------------------------------------------ |
| **ensDomain**        | The user’s ENS domain (if any)             |
| **address**          | The Ethereum address                       |
| **preferredName**    | Best name to display                       |
| **converseUsername** | The user’s Converse username (if any)      |
| **avatar**           | URL of the user’s profile picture (if any) |
| **converseEndpoint** | Endpoint for the user’s Converse profile   |

## Sending Messages

Here’s a quick snippet showing how you can utilize the resolver for your messaging:

```tsx
// Example user message object
let textMessage: agentMessage = {
  message: "Hello, world!",
  receivers: [
    "0x123...", // Ethereum address
    "vitalik.eth", // ENS
    "@fabri", // Converse username
    "https://example.com", // Website header tag or TXT record
  ],
  originalMessage: message, // optional original reference
};

await xmtp.send(textMessage);
```

## Cache

Skip the repeated lookups—use the built-in cache to store user data. Clear it whenever you need a fresh slate:

```typescript
import { userInfoCache } from "@xmtp/agent-starter";

// Clear the entire cache:
userInfoCache.clear();

// Clear a specific address from the cache:
userInfoCache.clear("0x1234...");
```

This makes repeated lookups lightning-fast, so you can focus on building cool stuff instead of waiting on network calls.
