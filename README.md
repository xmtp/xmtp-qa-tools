<div align="center">

<div align="center">
</div>

![Release](https://img.shields.io/website/http/huggingface.co/docs/smolagents/index.html.svg?down_color=red&down_message=offline&up_message=online)
[![MIT License](https://img.shields.io/github/license/ephemerahq/message-kit)](https://github.com/ephemerahq/message-kit/blob/main/LICENSE)
[![Number of GitHub stars](https://img.shields.io/github/stars/ephemerahq/message-kit?logo=github)](https://github.com/ephemerahq/message-kit)

<img src="media/logo.png" alt="Logo" width="60" />

</div>

---

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
        console.log(`Decoded message: ${message.content.text}`);

        // Your AI model response
        const response = await api("Hi, how are you?");

        //Send text message
        await agent.send({
          message: response,
          originalMessage: message,
        });
      };
  });

  console.log("Agent is up and running...");
}

main().catch(console.error);
```

> Try your agents on XMTP using [xmtp.chat](https://xmtp.chat)

## Recipes

See the avaialable [recipes](/recipes/) for examples to get started.

## Groups

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

> To learn more about groups, read the [XMTP documentation](https://docs.agent.org/inboxes/group-permissions).

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

## Send messages

App messages are messages that are sent when you send a reply to a message and are highlighted differently by the apps.

```tsx [Text]
let textMessage: agentMessage = {
  message: "Your message.",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
};
await agent.send(textMessage);
```

Agent message can be used to send any hidden metadata that is not meant to be read by inboxes allowing agents to communicate in a more flexible way, like in a JSON structure.

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
await agent.send(agentMessage);
```

> See other types like [reactions, replies and attachments](/packages/agent-starter/)

## Web inbox

Interact with the XMTP protocol using [xmtp.chat](https://xmtp.chat) the official web inbox for developers using the latest version powered by MLS.

![alt text](/media/chat.png)

## Address availability

Returns `true` if an address has XMTP enabled

```typescript
const isOnXMTP = await agent.canMessage(address);
```

## Resolver library

This library helps you to resolve identities into EVM addresses compatible with XMTP.

```typescript
import { resolve } from "@xmtp/resolver";

const identifier = "vitalik.eth";
const info = await resolve(identifier);

console.log(info);
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

> Learn more about [`@xmtp/resolver`](/packages/resolver/) library

## Deployment

Learn how to deploy with [Railway](/recipes/railway/) or [Replit](/recipes/replit/)
