import * as crypto from "crypto";
import * as fs from "fs";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

// Simple progress indicator
function showProgress(current: number, total: number, filename: string) {
  const percentage = Math.round((current / total) * 100);
  process.stdout.write(
    `\r🔍 Processing: ${filename} (${current}/${total}) ${percentage}%`,
  );
}

// Count duplicates based only on inboxId
function countInboxIdDuplicates(inboxes: InboxData[]): {
  inboxIdDuplicates: number;
  duplicateInboxIds: string[];
} {
  const inboxIdCounts = new Map<string, number>();
  for (const inbox of inboxes) {
    inboxIdCounts.set(
      inbox.inboxId,
      (inboxIdCounts.get(inbox.inboxId) || 0) + 1,
    );
  }
  const duplicateInboxIds = Array.from(inboxIdCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([inboxId]) => inboxId);
  return {
    inboxIdDuplicates: duplicateInboxIds.length,
    duplicateInboxIds,
  };
}

// Export the analysis function separately instead of running it automatically
export function analyzeInboxFiles(): void {
  console.log(`🔍 XMTP Duplicate InboxId Counter & Remover\n`);
  console.log(`📁 Analyzing JSON files in ${INBOXES_DIR}\n`);

  if (!fs.existsSync(INBOXES_DIR)) {
    console.error(`❌ Directory ${INBOXES_DIR} does not exist`);
    return;
  }

  // Get all JSON files that match the pattern (number.json)
  const files = fs
    .readdirSync(INBOXES_DIR)
    .filter((file) => file.endsWith(".json") && /^\d+\.json$/.test(file))
    .sort((a, b) => {
      const numA = parseInt(a.replace(".json", ""));
      const numB = parseInt(b.replace(".json", ""));
      return numA - numB;
    });

  if (files.length === 0) {
    console.log(`📄 No JSON files found in ${INBOXES_DIR}`);
    return;
  }

  let totalDuplicatesAcrossFiles = 0;
  let totalFilesWithDuplicates = 0;
  let totalRecordsRemoved = 0;
  const results: Array<{
    filename: string;
    count: number;
    inboxIdDuplicates: number;
    duplicateInboxIds: string[];
    removed: number;
  }> = [];

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = `${INBOXES_DIR}/${file}`;

    showProgress(i + 1, files.length, file);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (!Array.isArray(data)) {
        console.log(`\n⚠️  ${file}: Not an array, skipping`);
        continue;
      }

      // Type check the array elements
      const isValidInboxData = (item: unknown): item is InboxData => {
        if (typeof item !== "object" || item === null) {
          return false;
        }
        const inboxData = item as InboxData;
        return (
          typeof inboxData.accountAddress === "string" &&
          typeof inboxData.walletKey === "string" &&
          typeof inboxData.dbEncryptionKey === "string" &&
          typeof inboxData.inboxId === "string"
        );
      };

      const validData = data.filter(isValidInboxData);

      if (validData.length !== data.length) {
        console.log(
          `\n⚠️  ${file}: ${data.length - validData.length} invalid records skipped`,
        );
      }

      const count = validData.length;
      const { inboxIdDuplicates, duplicateInboxIds } =
        countInboxIdDuplicates(validData);

      // Deduplicate: keep only the first occurrence of each inboxId
      const seen = new Set<string>();
      const deduped = validData.filter((item) => {
        if (seen.has(item.inboxId)) return false;
        seen.add(item.inboxId);
        return true;
      });
      const removed = validData.length - deduped.length;
      totalRecordsRemoved += removed;

      // Overwrite the file if any records were removed
      if (removed > 0) {
        fs.writeFileSync(filePath, JSON.stringify(deduped, null, 2));
      }

      results.push({
        filename: file,
        count,
        inboxIdDuplicates,
        duplicateInboxIds,
        removed,
      });

      if (inboxIdDuplicates > 0) {
        totalFilesWithDuplicates++;
        totalDuplicatesAcrossFiles += inboxIdDuplicates;
      }
    } catch (error: unknown) {
      console.log(
        `\n❌ ${file}: Error reading file - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Clear progress line
  console.log(`\n`);

  // Display results
  console.log(`📋 DUPLICATE INBOXID ANALYSIS & REMOVAL RESULTS\n`);
  console.log(
    `${"File".padEnd(15)} ${"Accounts".padEnd(10)} ${"InboxID Duplicates".padEnd(18)} ${"Removed".padEnd(8)} Duplicate InboxIds (first 3)`,
  );
  console.log("─".repeat(100));

  for (const result of results) {
    const { filename, count, inboxIdDuplicates, duplicateInboxIds, removed } =
      result;
    console.log(
      `${filename.padEnd(15)} ${count.toString().padEnd(10)} ${inboxIdDuplicates.toString().padEnd(18)} ${removed.toString().padEnd(8)} ${duplicateInboxIds.slice(0, 3).join(", ")}${duplicateInboxIds.length > 3 ? ", ..." : ""}`,
    );
  }

  // Summary
  console.log("─".repeat(100));
  console.log(`\n📈 SUMMARY:`);
  console.log(`   📄 Total files analyzed: ${files.length}`);
  console.log(
    `   🔄 Total files with duplicate inboxIds: ${totalFilesWithDuplicates}`,
  );
  console.log(
    `   🔄 Total duplicate inboxIds found: ${totalDuplicatesAcrossFiles}`,
  );
  console.log(`   🧹 Total records removed: ${totalRecordsRemoved}`);
  console.log(`\n🎉 Analysis & deduplication complete!`);
}

function showHelp() {
  console.log(`
XMTP Generator Utility

Usage:
  yarn gen [options]

Options:
  --count <number>                Total number of accounts to ensure exist
  --envs <envs>                   Comma-separated environments (local,dev,production) (default: local)
  --installations <number>        Number of installations per account per network (default: 1)
  --mode <mode>                   Operation mode (default: update, options: update)

  --help                          Show this help message
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
) {
  let state =
    await clientCheckInstallations?.preferences.inboxStateFromInboxIds(
      [clientCheckInstallations.inboxId],
      true,
    );
  let currentInstallations = state?.[0]?.installations.length || 0;

  // If we have more installations than desired, revoke the surplus ones
  const surplus = currentInstallations - installationCount;
  if (surplus > 0) {
    const allInstallations = state?.[0]?.installations || [];

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
  const installationCount = installations || 2;

  // Load environment for local operations
  if (envs.includes("local")) {
    loadEnv("smart-update");
  }

  console.log(`\nConfiguration:
- Environments: ${envs.join(", ")}
- Installations per account: ${installationCount}
- Target accounts: ${count || "all existing"}`);

  // Determine target file based on installations number
  const targetFileName = `${installationCount}.json`;
  const targetFilePath = `${INBOXES_DIR}/${targetFileName}`;

  // Load existing inboxes from target file
  let existingInboxes: InboxData[] = [];
  if (fs.existsSync(targetFilePath)) {
    try {
      existingInboxes = JSON.parse(fs.readFileSync(targetFilePath, "utf8"));
    } catch (e) {
      console.error(`❌ Could not read inbox file: ${targetFilePath}`, e);
      existingInboxes = [];
    }
  }

  const existingCount = existingInboxes.length;
  const targetCount = count || existingCount;

  // Setup directories
  const folderName = `db-generated-${installationCount}-${envs.join(",")}-${installationCount}inst`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(LOGPATH)) {
    fs.mkdirSync(LOGPATH, { recursive: true });
  }
  analyzeInboxFiles();

  let totalCreated = 0;
  let totalFailed = 0;

  // Process existing accounts first (only up to target count)
  const accountsToProcess = Math.min(targetCount, existingCount);
  if (accountsToProcess > 0) {
    const updateProgress = new ProgressBar(accountsToProcess);

    for (let i = 0; i < accountsToProcess; i++) {
      const inbox = existingInboxes[i];

      try {
        if (!inbox.walletKey || !inbox.accountAddress || !inbox.inboxId) {
          totalFailed++;
          continue;
        }

        const encryptionKey = inbox.dbEncryptionKey;
        if (!encryptionKey) {
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
          );

          // Create additional installations if needed
          for (let j = currentInstallations; j <= installationCount; j++) {
            try {
              const dbPath = `${LOGPATH}/${env}-${inbox.accountAddress}-install-${j}`;

              await Client.create(signer, {
                dbEncryptionKey,
                dbPath: dbPath,
                env: env,
              });

              totalCreated++;
            } catch (e) {
              console.error(`❌ Could not create installation`, e);
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

        updateProgress.update();

        // Save progress after each account update
        fs.writeFileSync(
          targetFilePath,
          JSON.stringify(existingInboxes, null, 2),
        );
      } catch (e) {
        console.error(`❌ Could not update account`, e);
        totalFailed++;
        updateProgress.update();
      }
    }
    updateProgress.finish();
  }

  // Generate new accounts if needed
  const newAccountsNeeded = Math.max(0, targetCount - accountsToProcess);
  if (newAccountsNeeded > 0) {
    const generateProgress = new ProgressBar(newAccountsNeeded);

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (let i = 0; i < newAccountsNeeded; i++) {
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
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
                inboxId = client.inboxId;
              }

              totalCreated++;
            } catch (e) {
              console.error(`❌ Could not create installation`, e);
              totalFailed++;
              installationsFailed++;
            }
          }
        }

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
          consecutiveFailures = 0;

          fs.writeFileSync(
            targetFilePath,
            JSON.stringify(existingInboxes, null, 2),
          );
        } else {
          consecutiveFailures++;
        }

        generateProgress.update();
      } catch (e) {
        console.error(`❌ Could not create account`, e);
        totalFailed++;
        consecutiveFailures++;
        generateProgress.update();
      }
    }
    generateProgress.finish();
  }

  // Final cleanup and save
  const finalInboxes = removeDuplicates(existingInboxes);
  fs.writeFileSync(targetFilePath, JSON.stringify(finalInboxes, null, 2));

  console.log(`\nSummary:
- Total accounts: ${finalInboxes.length}
- Installations created: ${totalCreated}
- Installations failed: ${totalFailed}
- Data saved to: ${targetFilePath}`);
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
  let mode: string = "update";

  args.forEach((arg, i) => {
    if (arg === "--count") count = parseInt(args[i + 1], 10);
    if (arg === "--envs")
      envs = args[i + 1]
        .split(",")
        .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
    if (arg === "--installations") installations = parseInt(args[i + 1], 10);
    if (arg === "--mode") mode = args[i + 1];
  });

  // Run smart update with all parsed options
  await smartUpdate({ count, envs, installations });
}

main().catch(console.error);
