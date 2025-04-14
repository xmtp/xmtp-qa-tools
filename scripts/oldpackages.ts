import * as fs from "fs";
import { join } from "path";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/old_helper";
import { Client as ClientMls } from "@xmtp/node-sdk-mls";

const scriptName = "oldpackages";
async function main() {
  // Get number of accounts from command line arguments
  const args = process.argv.slice(2);
  const numAccounts = args.length > 0 ? parseInt(args[0], 10) : 10; // Default to 800 if no argument provided

  // Array to store account data
  const accountData = [];

  console.log(`Generating ${numAccounts} accounts with XMTP clients...`);

  for (let i = 0; i < numAccounts; i++) {
    // Generate a random private key
    const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    try {
      const encryptionKeyHex = generateEncryptionKeyHex();
      const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

      const user = createSigner();
      const client = await ClientMls.create(user.account.address, {
        env: "dev",
        encryptionKey: encryptionKey,
        dbPath: join("logs", `./test-${user.account.address}.db3`),
      });
      await ClientMls.create(user.account.address, {
        env: "production",
        encryptionKey: encryptionKey,
        dbPath: join("logs", `./test-${user.account.address}.db3`),
      });
      await ClientMls.create(user.account.address, {
        env: "local",
        encryptionKey: encryptionKey,
        dbPath: join("logs", `./test-${user.account.address}.db3`),
      });

      accountData.push({
        accountAddress: client.accountAddress,
        privateKey,
        encryptionKey: encryptionKeyHex,
        inboxId: client.inboxId,
        installationId: client.installationId,
      });

      // Write the data to a JSON file
      fs.writeFileSync(
        `./logs/${scriptName}.json`,
        JSON.stringify(accountData, null, 2),
      );
      console.log(
        `Created account ${i + 1}/${numAccounts}: ${client.accountAddress}`,
      );
    } catch (error: unknown) {
      console.error(`Error creating XMTP client for account ${i + 1}:`, error);
    }
  }

  console.log(
    `Successfully generated ${accountData.length} accounts with XMTP clients`,
  );
  console.log(`Data saved to ${scriptName}.json`);
}

main().catch(console.error);
