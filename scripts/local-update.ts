import * as fs from "fs";
import {
  createSigner,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

// Set constants
const BASE_LOGPATH = "./logs";
const SCRIPT_NAME = "local-update";
const ENV: XmtpEnv = "local";

// Load environment
loadEnv(SCRIPT_NAME);

// Function to ensure the log directory exists
function verifyStorage(logPath: string) {
  if (!fs.existsSync(logPath)) {
    console.log(`Creating directory: ${logPath}...`);
    fs.mkdirSync(logPath, { recursive: true });
  }
}

// Main function to update local inboxes
async function main() {
  console.log("Starting local inbox update...");

  // Check if there are any generated inboxes
  if (!generatedInboxes || generatedInboxes.length === 0) {
    console.error(
      "Error: No generated inboxes found in @helpers/generated-inboxes.json",
    );
    process.exit(1);
  }

  console.log(
    `Found ${generatedInboxes.length} inboxes to initialize in local environment`,
  );

  // Create a folder name based on count and environment
  const folderName = `db-generated-${generatedInboxes.length}-${ENV}`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;

  // Ensure the log directory exists
  verifyStorage(LOGPATH);

  // Keep track of successful and failed inboxes
  const results = {
    success: 0,
    failed: 0,
    inboxIds: [] as string[],
  };

  console.log(`Processing inboxes and storing data in: ${LOGPATH}`);

  // Create a timestamp for the output file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = `${LOGPATH}/local-inboxes-${timestamp}.json`;

  // Array to store updated account data
  const accountData = [];

  // Process each inbox
  for (let i = 0; i < generatedInboxes.length; i++) {
    const inbox = generatedInboxes[i];
    try {
      // Create signer from private key
      const signer = createSigner(inbox.privateKey as `0x${string}`);

      // Get encryption key from hex
      const dbEncryptionKey = getEncryptionKeyFromHex(inbox.encryptionKey);

      // Create a database path in the logs directory
      const dbPath = `${LOGPATH}/${ENV}-${inbox.accountAddress}`;

      console.log(
        `Initializing inbox ${i + 1}/${generatedInboxes.length}: ${inbox.accountAddress}`,
      );
      console.log(`Using database path: ${dbPath}`);

      // Create client in local environment
      const client = await Client.create(signer, {
        dbEncryptionKey,
        dbPath: dbPath,
        env: ENV,
      });

      // Verify the inbox ID matches what we expect
      if (client.inboxId !== inbox.inboxId) {
        console.warn(`Warning: Inbox ID mismatch for ${inbox.accountAddress}`);
        console.warn(`  Expected: ${inbox.inboxId}`);
        console.warn(`  Actual: ${client.inboxId}`);
      }

      // Store the updated account information
      accountData.push({
        accountAddress: inbox.accountAddress,
        inboxId: client.inboxId,
        privateKey: inbox.privateKey,
        encryptionKey: inbox.encryptionKey,
        dbPath: dbPath,
      });

      // Write the data to a JSON file after each successful initialization
      fs.writeFileSync(outputFile, JSON.stringify(accountData, null, 2));

      // Record the successful initialization
      results.success++;
      results.inboxIds.push(client.inboxId);

      console.log(`✅ Successfully initialized inbox: ${inbox.accountAddress}`);
    } catch (error) {
      results.failed++;
      console.error(`❌ Error initializing inbox ${inbox.accountAddress}:`);
      console.error(error instanceof Error ? error.message : String(error));
    }

    // Add a separator between inbox initializations
    console.log("-----------------------------------------------------");
  }

  // Display summary
  console.log("\n=== Local Inbox Update Summary ===");
  console.log(`Total inboxes processed: ${generatedInboxes.length}`);
  console.log(`Successfully initialized: ${results.success}`);
  console.log(`Failed to initialize: ${results.failed}`);
  console.log(`All data stored in: ${LOGPATH}`);
  console.log(`Data saved to: ${outputFile}`);

  if (results.success > 0) {
    console.log(
      "\nThese inboxes are now ready to use in your local XMTP environment.",
    );
    console.log(
      "You can use them in the stress test by setting XMTP_ENV=local in your .env file.",
    );
  }
}

main().catch(console.error);
