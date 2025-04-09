import * as fs from "fs";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import { Client } from "@helpers/types";

async function main() {
  // Get number of accounts from command line arguments
  const args = process.argv.slice(2);
  const numAccounts = args.length > 0 ? parseInt(args[0], 10) : 800; // Default to 800 if no argument provided

  // Array to store account data
  const accountData = [];

  console.log(`Generating ${numAccounts} accounts with XMTP clients...`);

  for (let i = 0; i < numAccounts; i++) {
    // Generate a random private key
    const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    try {
      const signer = createSigner(privateKey as `0x${string}`);
      const identifier = await signer.getIdentifier();
      const address = identifier.identifier;

      // Generate encryption key
      const encryptionKeyHex = generateEncryptionKeyHex();
      const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);
      // Create an XMTP client using the signer
      const client = await Client.create(signer, encryptionKey, {
        dbPath: `./scripts/db/dev-${address}`,
        env: "dev",
      });
      await Client.create(signer, encryptionKey, {
        dbPath: `./scripts/db/production-${address}`,
        env: "production",
      });
      await Client.create(signer, encryptionKey, {
        dbPath: `./scripts/db/local-${address}`,
        env: "local",
      });
      // Get the inbox ID for this client
      const inboxId = client.inboxId;
      // Store the account address and inbox ID
      accountData.push({
        accountAddress: address,
        inboxId,
        privateKey,
        encryptionKey: encryptionKeyHex,
      });

      // Write the data to a JSON file
      fs.writeFileSync(
        `./logs/generated-inboxes.json`,
        JSON.stringify(accountData, null, 2),
      );
      console.log(`Created account ${i + 1}/${numAccounts}: ${address}`);
    } catch (error: unknown) {
      console.error(`Error creating XMTP client for account ${i + 1}:`, error);
    }
  }

  console.log(
    `Successfully generated ${accountData.length} accounts with XMTP clients`,
  );
  console.log(`Data saved to generated-inboxes.json`);
}

main().catch(console.error);
