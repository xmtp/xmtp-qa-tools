# Building a gated group with NFT verification

> Try XMTP using [xmtp.chat](https://xmtp.chat)

In this tutorial, you’ll learn how to create and manage a private group where membership is gated by NFT ownership. We’ll build an Express server that verifies a wallet before adding it to the group, making it easy to manage NFT-based access to a conversation.

## Start the XMTP agent

Start your XMTP client and start listening to messages from the bot.

```tsx
async function main() {
  const agent = await runAgent({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    onMessage: async (message: Message) => {
      if (message.typeId !== "text") return;
      console.log(
        `[${message.typeId}] ${message?.content.text} by ${message.sender.address}`,
      );

      if (message?.content.text === "/create") {
        console.log("Creating group");
        const group = await createGroup(
          agent?.client,
          message?.sender?.address as string,
          agent?.address as string,
        );
        console.log("Group created", group?.id);
        await agent.send({
          message: `Group created!\n- ID: ${group?.id}\n- Group URL: https://converse.xyz/group/${group?.id}: \n- This url will deelink to the group inside Converse\n- Once in the other group you can share the invite with your friends.`,
          originalMessage: message,
        });
        return;
      } else {
        await agent.send({
          message:
            "👋 Welcome to the Gated Bot Group!\nTo get started, type /create to set up a new group. 🚀\nThis example will check if the user has a particular nft and add them to the group if they do.\nOnce your group is created, you'll receive a unique Group ID and URL.\nShare the URL with friends to invite them to join your group!",
          originalMessage: message,
        });
      }
    },
  });

  console.log(
    `XMTP agent initialized on ${agent?.address}\nSend a message on https://xmtp.chat or https://converse.xyz/dm/${agent?.address}`,
  );
}

main().catch(console.error);
```

## Create a gated group

Use the `createGroup` function to create a new group conversation and set both the user and the bot as super admins. Once created, you’ll have a `groupId` you can use to add others:

```tsx
export async function createGroup(
  client: Client | undefined,
  members: string[],
  senderAddress: string | undefined,
  clientAddress: string | undefined,
) {
  try {
    await client?.conversations.sync();
    const group = await client?.conversations.newGroup([members]);
    console.log("Group created", group?.id);

    // Grab members and find the sender
    const members = await group?.members();
    const senderMember = members?.find((member) =>
      member.accountAddresses.includes(senderAddress?.toLowerCase() ?? ""),
    );

    if (!senderMember) {
      console.log("Sender not found in members list");
      return undefined;
    }

    // Grant superAdmin privileges
    const senderInboxId = senderMember.inboxId;
    await group?.addSuperAdmin(senderInboxId);
    console.log(
      "Sender is superAdmin",
      await group?.isSuperAdmin(senderInboxId),
    );

    // Send welcome messages
    await group?.send(`Welcome to the new group!`);
    await group?.send(`You are now the admin of this group as well as the bot`);

    return group;
  } catch (error) {
    console.log("Error creating group", error);
    return undefined;
  }
}
```

**What this does:**

- Creates a new group conversation.
- Syncs conversations and grabs the newly created group’s ID.
- Finds the `senderAddress` in the group’s member list.
- Promotes the sender to `superAdmin`.
- Sends a couple of welcome messages.

## Spin up the verification server

The server provides a single endpoint to add a wallet address to a group—**but only if** the wallet holds the right NFT.

```tsx [src/index.ts]
export function startGatedGroupServer(client: Client) {
  async function addWalletToGroup(
    walletAddress: string,
    groupId: string,
  ): Promise<string> {
    // Check if wallet holds the "XMTPeople" NFT
    const verified = await checkNft(walletAddress, "XMTPeople");
    if (!verified) {
      console.log("User can't be added to the group");
      return "not verified";
    } else {
      try {
        // If verified, add the wallet to the group
        await addToGroup(groupId, client, walletAddress);
        return "success";
      } catch (error: any) {
        console.log(error.message);
        return "error";
      }
    }
  }

  const app = express();
  app.use(express.json());

  // POST endpoint that takes a wallet address and groupId
  app.post("/add-wallet", async (req, res) => {
    try {
      const { walletAddress, groupId } = req.body;
      const result = await addWalletToGroup(walletAddress, groupId);
      res.status(200).send(result);
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  // Start the server
  const PORT = process.env.PORT || 3000;
  const url = process.env.URL || `http://localhost:${PORT}`;
  app.listen(PORT, () => {
    console.warn(
      `Use this endpoint to add a wallet to a group using the groupId\n${url}/add-wallet <body: {walletAddress, groupId}>`,
    );
  });
}
```

**Key points:**

- `checkNft(walletAddress, "XMTPeople")`: a function (not shown here) that verifies if a wallet holds the “XMTPeople” NFT.
- Only verified addresses are added to the group with `addToGroup(...)`.
- The server logs important messages to keep you informed.

## Check the NFT with alchemy

```tsx
import { Alchemy, Network } from "alchemy-sdk";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API key
  network: Network.BASE_MAINNET, // Use the appropriate network
};

export async function checkNft(
  walletAddress: string,
  collectionSlug: string,
): Promise<boolean> {
  const alchemy = new Alchemy(settings);
  try {
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress);

    const ownsNft = nfts.ownedNfts.some(
      (nft: any) =>
        nft.contract.name.toLowerCase() === collectionSlug.toLowerCase(),
    );
    console.log("is the nft owned: ", ownsNft);
    return ownsNft as boolean;
  } catch (error) {
    console.error("Error fetching NFTs from Alchemy:", error);
  }

  return false;
}
```

## Test the Endpoint

Once your server is running (by default on port `3000`), test the `add-wallet` endpoint with your chosen wallet and the `groupId` you received from `createGroup`:

```bash
curl -X POST http://localhost:3000/add-wallet \
 -H "Content-Type: application/json" \
 -d '{"walletAddress": "0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204", "groupId": "b9ab876c87ef3cf63b81c8d45c824fae"}'
```

If the wallet is verified for your NFT, you should get a `"success"` response, and the user will be added to the group. Otherwise, you’ll see `"not verified"` or `"error"` in the response.

### That’s It!

You now have a gated group chat that only NFT holders can access. Combine these steps with any front-end application to create exclusive communities, coordinate DAO discussions, or manage membership-based chat groups. Happy building!
