<div align="center">

[![GitHub release](https://img.shields.io/github/release/ephemerahq/xmtp-agents.svg)](https://github.com/huggingface/smolagents/releases)
[![MIT License](https://img.shields.io/github/license/ephemerahq/xmtp-agents)](https://github.com/ephemerahq/xmtp-agents/blob/main/LICENSE)
[![Number of GitHub stars](https://img.shields.io/github/stars/ephemerahq/message-kit?logo=github)](https://github.com/ephemerahq/message-kit)

<img src="media/logo.png" alt="Logo" width="60" />

# xmtp-agents

</div>

`xmtp-agents` is a library that enables you to run scalable, secure and interoperable agents using [XMTP](https://xmtp.org/) as the standard.

- **End-to-end**: Servers only see cipher text, preventing data exfiltration through server breaches or insider threats.
- **Security**: XMTP is built on the IETF-standard Messaging Layer Security (MLS) protocol – the same open-source security foundation trusted by Mozilla, Google, Wire, and Cisco.
- **Standardize**: XMTP plugs into existing AI tooling or enterprise environments stardazing secure agent communication without needing overhead in implementation.
- **Trustless**: Traditional TLS depends on certificate providers for trust. XMTP avoids single points of failure by leveraging mathematics.
- **Ephemeral identities**: Users can remain pseudonymous, minimizing data collection while still enabling secure conversations.
- **Metadata protection**: Prevents tracking of additional data like timestamps and message routes, IP, location or device
- **Compliant**: Enterprise regulations increasingly require that sensitive data be inaccessible to employees or intermediaries, something **server-level TLS** cannot guarantee.
- **Decentralized**: XMTP runs on a decentralized network enabling peer-to-peer messaging without relying on central servers.
- **Groups**: XMTP supports secure group communication among many agents (and humans), which is central to multi-agent and mult-human workflows.

---

## Setup

[` @xmtp/agent-starter`](/packages/agent-starter/) is convenient TypeScript wrapper around [@xmtp/node-sdk](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk) simplifying agent delopment.

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

Various examples and tutorials to help you get started with creating and deploying your own agents using XMTP.

- [Gated group](/recipes/gated-group/): Create a gated group chat that verifies NFT ownership using Alchemy.
- [GM](/recipes/gm/): A simple agent that replies with "GM".
- [GPT](/recipes/gpt): A simple agent that interacts with OpenAI APIs.

See all the avaialable [recipes](/recipes/).

## Groups

> [!TIP]
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

> [!WARNING]
> This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.

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

## Development

```bash
git clone https://github.com/ephemeraHQ/xmtp-agents/
cd xmtp-agents
```

Run it:

```bash
yarn install
yarn recipes
```

### .env

XMTP requires 2 key to initiate your client.

- `ENCRYPTION_KEY`: The private key of the wallet that will be used to send or receive messages.
- `FIXED_KEY`: A secondary key that ensures local device encryption. Can be random.

> [!TIP]
> If not specified the `.env` file will be populated **randomly**.

```bash
ENCRYPTION_KEY= # the private key of the wallet
FIXED_KEY= # a second encryption key for encryption, can be random
```

### Contribute

Learn how to [contribute](/CONTRIBUTING.md) to the recipes directory.

### Deployment

Learn how to deploy with [Railway](/recipes/railway/) or [Replit](/recipes/replit/)
