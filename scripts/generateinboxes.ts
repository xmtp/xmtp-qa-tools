import * as fs from "fs";
import {
  createSigner,
  createUser,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import { Client } from "@helpers/types";

async function main() {
  // Number of accounts to generate
  const numAccounts = 200;

  // Array to store account data
  const accountData = [];

  console.log(`Generating ${numAccounts} accounts with XMTP clients...`);

  for (let i = 0; i < numAccounts; i++) {
    // Generate a random private key
    const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    try {
      const signer = createSigner(privateKey as `0x${string}`);

      // Generate encryption key
      const encryptionKeyHex = generateEncryptionKeyHex();
      const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);
      // Create an XMTP client using the signer
      const client = await Client.create(signer, encryptionKey, {
        env: "dev",
      });
      await Client.create(signer, encryptionKey, {
        env: "production",
      });
      // Get the inbox ID for this client
      const inboxId = client.inboxId;
      const accountAddress = client.inboxId;

      // Store the account address and inbox ID
      accountData.push({
        accountAddress,
        inboxId,
      });

      console.log(`Created account ${i + 1}/${numAccounts}: ${accountAddress}`);
    } catch (error: unknown) {
      console.error(`Error creating XMTP client for account ${i + 1}:`, error);
    }
  }

  // Write the data to a JSON file
  fs.writeFileSync(
    "scripts/generated-inboxes.json",
    JSON.stringify(accountData, null, 2),
  );

  console.log(
    `Successfully generated ${accountData.length} accounts with XMTP clients`,
  );
  console.log(`Data saved to generated-inboxes.json`);
}

main().catch((error: unknown) => {
  console.error("Error in main function:", error);
  process.exit(1);
});
