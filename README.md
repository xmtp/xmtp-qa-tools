# XMTP Agent Examples

This repository contains examples of agents that use the XMTP protocol.

#### Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of sender routes, IPs, or device and message timestamps.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Multi-tenant**: Allows multi-agent multi-human confidential communication over MLS group chats.

> See [FAQ](https://docs.xmtp.org/intro/faq) for more detailed information.

## Environment variables

To run your XMTP agent, you need two keys:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second fixed or random 32 bytes encryption key for the local db
```

## Examples

Various examples and tutorials to help you get started with creating and deploying your own agents using XMTP.

- [gated-group](/examples/gated-group/): Create a gated group chat that verifies NFT ownership using Alchemy.
- [gm](/examples/gm/): A simple agent that replies with `gm`.

> See all the available [examples](/examples/).

## Groups

> [!NOTE]
> You need to add the agent **as a member** to the group.

To create a group from your agent, you can use the following code:

```tsx
const group = await client?.conversations.newGroup([address1, address2]);
```

As an admin you can add members to the group.

```tsx
// get the group
await group.sync();
//By address
await group.addMembers([0xaddresses]);
```

> To learn more about groups, read the [XMTP documentation](https://docs.xmtp.org).

## Web inbox

Interact with the XMTP protocol using [xmtp.chat](https://xmtp.chat) the official web inbox for developers using the latest version powered by MLS.

![](/media/chat.png)

> [!WARNING]
> This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.
