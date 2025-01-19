<div align="center">

[![GitHub release](https://img.shields.io/github/release/ephemerahq/xmtp-agents.svg)](https://github.com/huggingface/smolagents/releases)
[![MIT License](https://img.shields.io/github/license/ephemerahq/xmtp-agents)](https://github.com/ephemerahq/xmtp-agents/blob/main/LICENSE)
[![Number of GitHub stars](https://img.shields.io/github/stars/ephemerahq/message-kit?logo=github)](https://github.com/ephemerahq/message-kit)

<img src="media/logo.png" alt="Logo" width="60" />

# xmtp-agents

</div>

`xmtp-agents` is a library for building scalable, secure, and interoperable agents that use the [XMTP](https://xmtp.org/) protocol

#### Why XMTP?

- **End-to-end & compliant**: Servers and clients only see ciphertext, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of timestamps, routes, IPs, or device info.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Groups**: Allows multi-agent (or multi-human) or both with group chats with access control and secure collaboration.

## Setup

This library is based on [`@xmtp/agent-starter`](https://github.com/ephemeraHQ/xmtp-agents/tree/main/packages/agent-starter).

```bash
yarn add @xmtp/agent-starter
```

### Environment variables

To run your XMTP agent, you need two keys:

```bash
ENCRYPTION_KEY= # the private key of the wallet
FIXED_KEY= # a second encryption key for encryption (can be random)
```

> See [encryption keys](https://github.com/ephemeraHQ/xmtp-agents/tree/main/packages/agent-starter/README.md#encryption-keys) to learn more.

## Basic usage

These are the steps to initialize the XMTP listener and send messages.

- `ENCRYPTION_KEY`: The private key of the wallet that will be used to send or receive messages.

```tsx
import { xmtpClient } from "@xmtp/agent-starter";

async function main() {
  const agent = await xmtpClient({
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

## Examples

Various examples and tutorials to help you get started with creating and deploying your own agents using XMTP.

- [gated-group](/examples/gated-group/): Create a gated group chat that verifies NFT ownership using Alchemy.
- [gm](/examples/gm/): A simple agent that replies with "GM".
- [gpt](/examples/gpt): A simple agent that interacts with OpenAI APIs.
- [express](/examples/express/): Communicate with traditional api endpoints using xmtp e2ee

> See all the available [examples](/examples/).

## Deployment

Learn how to deploy with [Railway](/examples/railway/) or [Replit](/examples/replit/)

## Groups

> [!TIP]
> You need to add the agent **as a member** to the group.

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

## Message handling

`agent-starter` provides an abstraction to XMTP [content types](https://github.com/xmtp/xmtp-js/tree/main/content-types) to make it easier for devs to integrate different types of messages.

### Receiving messages

All new messages trigger the `onMessage` callback:

```tsx
const onMessage = async (message: Message) => {
  console.log(
    `Decoded message: ${message.content.text} from ${message.sender.address}`,
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

### Sending messages

Use `agent.send()` for different message types.

#### Text messages

```tsx
await agent.send({
  message: "Hello from xmtp-agents!",
  receivers: ["0x123..."], // optional
  originalMessage: message, // optional
});
```

#### Agent messages

Agent messages can contain metadata, enabling structured communication between agents:

```tsx
await agent.send({
  message: "Transaction request",
  metadata: {
    amount: "10",
    token: "USDC",
  },
  receivers: ["0x123..."],
  originalMessage: message,
  typeId: "agent_message",
});
```

## Web inbox

Interact with the XMTP protocol using [xmtp.chat](https://xmtp.chat) the official web inbox for developers using the latest version powered by MLS.

![alt text](/media/chat.png)

> [!WARNING]
> This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.

## Address availability

Returns `true` if an address has XMTP enabled

```tsx
const isOnXMTP = await agent.canMessage(address);
```

## Resolver library

This library helps you to resolve identities into EVM addresses compatible with XMTP.

```tsx
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
  converseEndpoint: 'https://converse.xyz/...'
}
*/
```

> Learn more about [`@xmtp/resolver`](/packages/resolver/) library

## Development

```bash
# clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agents/
cd xmtp-agents

# install dependencies
yarn install
# build
yarn build

# run sample agents from the examples directory
yarn examples

# or run a specific example
yarn examples gm
```

Use a `.env` file for your environment variables:

```bash
ENCRYPTION_KEY= # the private key of the wallet
FIXED_KEY= # a second encryption key for encryption (can be random)
```

## Contribute

We welcome contributions! Check out the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information on how to get started.
