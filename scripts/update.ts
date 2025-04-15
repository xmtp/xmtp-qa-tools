import * as fs from "fs";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client } from "@xmtp/node-sdk";

interface AccountData {
  accountAddress: string;
  inboxId: string;
  privateKey: string;
  encryptionKey: string;
}

async function restartClients() {
  try {
    // Read the generated inboxes file
    const rawData = fs.readFileSync("./helpers/generated-inboxes.json", "utf8");
    const accounts: AccountData[] = JSON.parse(rawData);

    console.log(`Restarting ${accounts.length} XMTP clients...`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      try {
        // Create a signer from the private key
        const signer = createSigner(account.privateKey as `0x${string}`);

        // Get encryption key from stored hex
        const encryptionKey = getEncryptionKeyFromHex(account.encryptionKey);
        console.log(account.accountAddress);
        if (!fs.existsSync(`./logs/dummy/`)) {
          fs.mkdirSync(`./logs/dummy/`, {
            recursive: true,
          });
        }
        await Client.create(signer, {
          dbEncryptionKey: encryptionKey,
          dbPath: `./logs/dummy/${account.accountAddress}`,
          env: "local",
        });

        console.log(
          `Restarted client ${i + 1}/${accounts.length}: ${account.accountAddress}`,
        );
      } catch (error) {
        console.error(
          `Error restarting client for account ${account.accountAddress}:`,
          error,
        );
      }
    }

    console.log(`Successfully restarted ${accounts.length} XMTP clients`);
  } catch (error) {
    console.error("Error reading or processing generated-inboxes.json:", error);
  }
}

restartClients().catch((error: unknown) => {
  console.error("Error in restartClients function:", error);
  process.exit(1);
});
