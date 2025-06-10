import * as crypto from "crypto";
import * as fs from "fs";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

function showHelp() {
  console.debug(`
XMTP Generator Utility

Usage:
  yarn gen [options]

Options:
  --count <number>                Total number of accounts to ensure exist
  --envs <envs>                   Comma-separated environments (local,dev,production) (default: local)
  --installations <number>        Number of installations per account per network (default: 1)

  --help                          Show this help message

Smart Logic:
  - Works directly with inbox files (e.g., 2.json for 2 installations)
  - Updates installations for existing accounts as needed
  - Generates new accounts if count exceeds existing accounts
  - Removes duplicates automatically
  - Shows cool progress bars for all operations
  - Keeps database files in logs/ folder
`);
}

const BASE_LOGPATH = "./logs";
const INBOXES_DIR = "./inboxes";

// Simple progress bar implementation
class ProgressBar {
  private total: number;
  private current: number;
  private barLength: number;
  private lastUpdate: number;

  constructor(total: number, barLength: number = 40) {
    this.total = total;
    this.current = 0;
    this.barLength = barLength;
    this.lastUpdate = Date.now();
  }

  update(current?: number) {
    if (current !== undefined) {
      this.current = current;
    } else {
      this.current++;
    }

    const now = Date.now();
    // Only update every 100ms to avoid flickering
    if (now - this.lastUpdate < 100 && this.current < this.total) {
      return;
    }
    this.lastUpdate = now;

    // Safety checks to prevent negative values
    const safeTotal = Math.max(1, this.total);
    const safeCurrent = Math.max(0, Math.min(this.current, safeTotal));

    const percentage = Math.round((safeCurrent / safeTotal) * 100);
    const filled = Math.max(
      0,
      Math.round((safeCurrent / safeTotal) * this.barLength),
    );
    const empty = Math.max(0, this.barLength - filled);

    const bar = "█".repeat(filled) + "░".repeat(empty);
    const status = `${safeCurrent}/${safeTotal}`;

    process.stdout.write(`\r🚀 Progress: [${bar}] ${percentage}% (${status})`);

    if (this.current >= this.total) {
      process.stdout.write("\n");
    }
  }

  finish() {
    this.current = this.total;
    this.update();
  }
}

// Type definitions for inbox data
interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
  dbPath?: string;
}

function removeDuplicates(inboxes: InboxData[]): InboxData[] {
  const seen = new Set<string>();
  const unique: InboxData[] = [];
  let duplicatesRemoved = 0;

  for (const inbox of inboxes) {
    // Create a unique key based on critical fields
    const key = `${inbox.accountAddress.toLowerCase()}-${inbox.inboxId}-${inbox.walletKey}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(inbox);
    } else {
      duplicatesRemoved++;
    }
  }

  if (duplicatesRemoved > 0) {
    console.debug(`🧹 Removed ${duplicatesRemoved} duplicate accounts`);
  }

  return unique;
}

async function checkInstallations(
  clientCheckInstallations: Client,
  installationCount: number,
  i: number,
) {
  let state = await clientCheckInstallations?.preferences.inboxState(true);
  let currentInstallations = state?.installations.length || 0;
  console.debug(`${i} ${currentInstallations}/${installationCount}`);

  // If we have more installations than desired, revoke the surplus ones
  if (currentInstallations > installationCount) {
    const surplusCount = currentInstallations - installationCount;
    const allInstallations = state?.installations || [];

    // Get the installation IDs to revoke (keeping the first ones, revoking the last ones)
    const installationsToRevoke = allInstallations
      .slice(installationCount)
      .map((install) => {
        // Convert hex string to Uint8Array
        const hexString = install.id.startsWith("0x")
          ? install.id.slice(2)
          : install.id;
        return new Uint8Array(Buffer.from(hexString, "hex"));
      });

    if (installationsToRevoke.length > 0) {
      console.debug(`Revoking ${surplusCount} surplus installations...`);
      await clientCheckInstallations.revokeInstallations(installationsToRevoke);
      currentInstallations = installationCount;
    }
  }

  return { clientCheckInstallations, currentInstallations };
}

async function smartUpdate(opts: {
  count?: number;
  envs?: XmtpEnv[];
  installations?: number;
}) {
  let { count, envs, installations } = opts;

  // Set defaults
  envs = envs || ["local"];
  const installationCount = installations || 1;

  // Load environment for local operations
  if (envs.includes("local")) {
    loadEnv("smart-update");
  }

  console.debug(`🚀 XMTP Smart Inbox Generator`);
  console.debug(`📁 Using environments: ${envs.join(", ")}`);
  console.debug(
    `⚙️  Target installations per account per network: ${installationCount}`,
  );

  // Determine target file based on installations number
  const targetFileName = `${installationCount}.json`;
  const targetFilePath = `${INBOXES_DIR}/${targetFileName}`;

  // Load existing inboxes from target file
  let existingInboxes: InboxData[] = [];
  if (fs.existsSync(targetFilePath)) {
    try {
      existingInboxes = JSON.parse(fs.readFileSync(targetFilePath, "utf8"));
      console.debug(
        `📋 Loaded ${existingInboxes.length} accounts from ${targetFileName}`,
      );
    } catch (e) {
      console.error(`❌ Could not read inbox file: ${targetFilePath}`, e);
      existingInboxes = [];
    }
  } else {
    console.debug(`📄 Creating new inbox file: ${targetFileName}`);
  }

  const existingCount = existingInboxes.length;
  const targetCount = count || existingCount;

  console.debug(`📊 Existing accounts: ${existingCount}`);
  console.debug(`🎯 Target accounts: ${targetCount}`);

  // Setup directories
  const folderName = `db-generated-${installationCount}-${envs.join(",")}-${installationCount}inst`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(LOGPATH)) {
    console.debug(`📁 Creating directory: ${LOGPATH}...`);
    fs.mkdirSync(LOGPATH, { recursive: true });
  }

  let totalCreated = 0;
  let totalFailed = 0;
  let totalUpdated = 0;

  // Process existing accounts first (only up to target count)
  const accountsToProcess = Math.min(targetCount, existingCount);
  if (accountsToProcess > 0) {
    console.debug(`\n🔄 Updating ${accountsToProcess} existing accounts`);
    const updateProgress = new ProgressBar(accountsToProcess);

    for (let i = 0; i < accountsToProcess; i++) {
      const inbox = existingInboxes[i];

      try {
        if (!inbox.walletKey || !inbox.accountAddress || !inbox.inboxId) {
          console.error(
            `❌ Invalid inbox data for account ${i + 1}: missing required fields`,
          );
          totalFailed++;
          continue;
        }

        const encryptionKey = inbox.dbEncryptionKey;
        if (!encryptionKey) {
          console.error(
            `❌ Invalid inbox data for account ${i + 1}: missing encryption key`,
          );
          totalFailed++;
          continue;
        }

        const signer = createSigner(inbox.walletKey as `0x${string}`);
        const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);

        for (const env of envs) {
          let clientCheckInstallations = await Client.create(signer, {
            dbEncryptionKey,
            dbPath: `${LOGPATH}/${env}-${inbox.accountAddress}-install-0`,
            env: env,
          });

          const { currentInstallations } = await checkInstallations(
            clientCheckInstallations,
            installationCount,
            i,
          );

          // Create additional installations if needed
          for (let j = currentInstallations; j < installationCount; j++) {
            try {
              const dbPath = `${LOGPATH}/${env}-${inbox.accountAddress}-install-${j}`;

              await Client.create(signer, {
                dbEncryptionKey,
                dbPath: dbPath,
                env: env,
              });

              totalCreated++;
            } catch (error) {
              console.error(
                `\n❌ Failed to create installation ${j + 1}/${installationCount} for ${inbox.accountAddress}:`,
                error instanceof Error ? error.message : String(error),
              );
              totalFailed++;
            }
          }

          // Update dbPath for the account
          if (env === envs[0]) {
            existingInboxes[i].dbPath =
              `${LOGPATH}/${env}-${inbox.accountAddress}-install-0`;
            existingInboxes[i].installations = installationCount;
          }
        }

        totalUpdated++;
        updateProgress.update();

        // Save progress after each account update
        fs.writeFileSync(
          targetFilePath,
          JSON.stringify(existingInboxes, null, 2),
        );
      } catch (error) {
        totalFailed++;
        console.error(`\n❌ Error updating inbox ${inbox.accountAddress}:`);
        console.error(error instanceof Error ? error.message : String(error));
        updateProgress.update();
      }
    }
    updateProgress.finish();
  }

  // Generate new accounts if needed
  const newAccountsNeeded = Math.max(0, targetCount - accountsToProcess);
  if (newAccountsNeeded > 0) {
    console.debug(`\n✨ Generating ${newAccountsNeeded} new accounts`);
    const generateProgress = new ProgressBar(newAccountsNeeded);

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (let i = 0; i < newAccountsNeeded; i++) {
      // Stop if we hit too many consecutive failures
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `\n🛑 Stopping generation after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
        );
        break;
      }

      const walletKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

      try {
        const signer = createSigner(walletKey as `0x${string}`);
        const identifier = await signer.getIdentifier();
        const accountAddress = identifier.identifier;
        const dbEncryptionKey = generateEncryptionKeyHex();
        let inboxId = "";
        let installationsFailed = 0;

        // Create installations for each environment
        for (const env of envs) {
          for (let j = 0; j < installationCount; j++) {
            try {
              const client = await Client.create(signer, {
                dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
                dbPath: `${LOGPATH}/${env}-${accountAddress}-install-${j}`,
                env: env,
              });

              if (j === 0 && env === envs[0]) {
                inboxId = client.inboxId; // Use the first installation's inboxId
              }

              totalCreated++;
            } catch (error) {
              console.error(
                `\n❌ Failed to create installation ${j + 1}/${installationCount} for new account ${accountAddress}:`,
                error instanceof Error ? error.message : String(error),
              );
              totalFailed++;
              installationsFailed++;
            }
          }
        }

        // Only add account if at least one installation succeeded
        if (installationsFailed < installationCount * envs.length) {
          const newAccount: InboxData = {
            accountAddress,
            walletKey,
            dbEncryptionKey,
            inboxId,
            installations: installationCount,
            dbPath: `${LOGPATH}/${envs[0]}-${accountAddress}-install-0`,
          };

          existingInboxes.push(newAccount);
          consecutiveFailures = 0; // Reset failure counter on success

          // Save progress after each new account
          fs.writeFileSync(
            targetFilePath,
            JSON.stringify(existingInboxes, null, 2),
          );
        } else {
          consecutiveFailures++;
        }

        generateProgress.update();
      } catch (error: unknown) {
        console.error(
          `\nError generating account ${existingCount + i + 1}:`,
          error,
        );
        totalFailed++;
        consecutiveFailures++;
        generateProgress.update();
      }
    }
    generateProgress.finish();
  }

  // Final cleanup and save
  const finalInboxes = removeDuplicates(existingInboxes);

  // Save directly to the target file
  fs.writeFileSync(targetFilePath, JSON.stringify(finalInboxes, null, 2));

  console.debug(`\n🎉 Smart Update Summary`);
  console.debug(
    `📊 Existing accounts processed: ${Math.min(totalUpdated, accountsToProcess)}`,
  );
  console.debug(
    `✨ New accounts generated: ${finalInboxes.length - accountsToProcess}`,
  );
  console.debug(`🎯 Total accounts in final file: ${finalInboxes.length}`);
  console.debug(`✅ Total installations created: ${totalCreated}`);
  console.debug(`❌ Total installations failed: ${totalFailed}`);
  console.debug(`💾 Data saved to: ${targetFilePath}`);
  console.debug(`📁 Database files stored in: ${LOGPATH}`);

  if (finalInboxes.length > 0) {
    console.debug(
      "\n🚀 These inboxes are now ready to use in your XMTP environment!",
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Parse all arguments
  let count: number | undefined;
  let envs: XmtpEnv[] | undefined;
  let installations: number | undefined;

  args.forEach((arg, i) => {
    if (arg === "--count") count = parseInt(args[i + 1], 10);
    if (arg === "--envs")
      envs = args[i + 1]
        .split(",")
        .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
    if (arg === "--installations") installations = parseInt(args[i + 1], 10);
  });

  // Run smart update with all parsed options
  await smartUpdate({ count, envs, installations });
}

main().catch(console.error);
