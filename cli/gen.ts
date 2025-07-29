import * as crypto from "crypto";
import * as fs from "fs";
import { Client, type XmtpEnv } from "@workers/versions";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "../helpers/client";

const BASE_LOGPATH = "./logs";
const INBOXES_DIR = "./inboxes";
let debugMode = false;

// === Tweakable Defaults ===
const DEFAULT_COUNT = 200;
const DEFAULT_ENVS: XmtpEnv[] = ["local"];
const DEFAULT_INSTALLATIONS = 2;
const MAX_RETRIES = 3;
// =========================

interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
}

const debugLog = (...args: unknown[]) => {
  if (debugMode) console.log(...args);
};

function showHelp() {
  console.log(`
XMTP Generator CLI - Test inbox and key generation

USAGE:
  yarn gen [options]

OPTIONS:
  --count <number>       Number of inboxes to generate [default: 200]
  --envs <environments>  Comma-separated environments (local,dev,production) [default: production]
  --installations <num>  Number of installations per inbox [default: 2]
  --debug               Enable debug logging
  --clean               Clean up logs/ and .data/ directories before running
  -h, --help            Show this help message

ENVIRONMENTS:
  local       Local XMTP network for development
  dev         Development XMTP network
  production  Production XMTP network

EXAMPLES:
  yarn gen --count 500 --envs local
  yarn gen --envs local,dev --installations 3
  yarn gen --clean --debug
  yarn gen --help

PRESET COMMANDS:
  yarn update:local      Generate 500 inboxes for local testing
  yarn update:prod       Generate inboxes for production testing

For more information, see: cli/readme.md
`);
}

// Cleanup function
function cleanup() {
  console.log("🧹 Cleaning up logs/ and .data/ directories...");
  if (fs.existsSync("./logs")) {
    fs.rmSync("./logs", { recursive: true, force: true });
    console.log("✅ Removed logs/");
  }
  if (fs.existsSync("./.data")) {
    fs.rmSync("./.data", { recursive: true, force: true });
    console.log("✅ Removed .data/");
  }
}

// Retry function
async function runWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string = "operation",
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `🔄 Running ${operationName} (attempt ${attempt}/${MAX_RETRIES})`,
      );
      const result = await operation();
      console.log(`✅ Successfully completed ${operationName}`);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.log(`❌ ${operationName} failed with error: ${String(error)}`);

      if (attempt < MAX_RETRIES) {
        console.log("⏳ Retrying in 2 seconds to avoid rate limits...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(
    `Failed all ${MAX_RETRIES} attempts for ${operationName}: ${lastError?.message}`,
  );
}

class ProgressBar {
  private total: number;
  private current = 0;
  private barLength: number;
  private lastUpdate = Date.now();
  constructor(total: number, barLength = 40) {
    this.total = total;
    this.barLength = barLength;
  }
  update(current?: number) {
    if (current !== undefined) this.current = current;
    else this.current++;
    const now = Date.now();
    if (now - this.lastUpdate < 100 && this.current < this.total) return;
    this.lastUpdate = now;
    const pct = Math.round((this.current / Math.max(1, this.total)) * 100);
    const filled = Math.round(
      (this.current / Math.max(1, this.total)) * this.barLength,
    );
    const bar = "█".repeat(filled) + "░".repeat(this.barLength - filled);
    process.stdout.write(
      `\r🚀 Progress: [${bar}] ${pct}% (${this.current}/${this.total})`,
    );
    if (this.current >= this.total) process.stdout.write("\n");
  }
  finish() {
    this.current = this.total;
    this.update();
  }
}

function readJson(path: string): InboxData[] | undefined {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as InboxData[];
  } catch {
    return undefined;
  }
}
function writeJson(path: string, data: unknown) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function removeDuplicates(inboxes: InboxData[]): InboxData[] {
  const seen = new Set<string>();
  return inboxes.filter((inbox) => {
    const key = `${inbox.accountAddress.toLowerCase()}-${inbox.inboxId}-${inbox.walletKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countInboxIdDuplicates(inboxes: InboxData[]) {
  const counts = new Map<string, number>();
  for (const { inboxId } of inboxes)
    counts.set(inboxId, (counts.get(inboxId) || 0) + 1);
  const dups = Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([id]) => id);
  return { inboxIdDuplicates: dups.length, duplicateInboxIds: dups };
}

function analyzeInboxFiles() {
  if (!fs.existsSync(INBOXES_DIR)) {
    console.error(`❌ Directory ${INBOXES_DIR} does not exist`);
    return;
  }
  const files = fs
    .readdirSync(INBOXES_DIR)
    .filter((f) => f.endsWith(".json") && /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));
  if (!files.length) {
    console.log(`📄 No JSON files found in ${INBOXES_DIR}`);
    return;
  }
  const results = files.map((file: string) => {
    const filePath = `${INBOXES_DIR}/${file}`;
    const data = (readJson(filePath) as InboxData[]) || [];
    const valid = data.filter(
      (d: InboxData) =>
        d &&
        typeof d.accountAddress === "string" &&
        typeof d.walletKey === "string" &&
        typeof d.dbEncryptionKey === "string" &&
        typeof d.inboxId === "string",
    );
    const { inboxIdDuplicates, duplicateInboxIds } =
      countInboxIdDuplicates(valid);
    const seen = new Set<string>();
    const deduped = valid.filter((i: InboxData) =>
      seen.has(i.inboxId) ? false : (seen.add(i.inboxId), true),
    );
    const removed = valid.length - deduped.length;
    if (removed > 0) writeJson(filePath, deduped);
    return {
      filename: file,
      count: valid.length,
      inboxIdDuplicates,
      duplicateInboxIds,
      removed,
    };
  });
  if (debugMode) showFileStats(results);
}

function showFileStats(
  results: Array<{
    filename: string;
    count: number;
    inboxIdDuplicates: number;
    duplicateInboxIds: string[];
    removed: number;
  }>,
) {
  console.log(`📋 DUPLICATE INBOXID ANALYSIS & REMOVAL RESULTS\n`);
  console.log(
    `${"File".padEnd(15)} ${"Accounts".padEnd(10)} ${"InboxID Duplicates".padEnd(18)} ${"Removed".padEnd(8)} Duplicate InboxIds (first 3)`,
  );
  console.log("─".repeat(100));
  for (const r of results) {
    console.log(
      `${r.filename.padEnd(15)} ${r.count.toString().padEnd(10)} ${r.inboxIdDuplicates.toString().padEnd(18)} ${r.removed.toString().padEnd(8)} ${r.duplicateInboxIds.slice(0, 3).join(", ")}${r.duplicateInboxIds.length > 3 ? ", ..." : ""}`,
    );
  }
  console.log("─".repeat(100));
  console.log(`\n📈 SUMMARY:`);
  console.log(`   📄 Total files analyzed: ${results.length}`);
  console.log(
    `   🔄 Total files with duplicate inboxIds: ${results.filter((r) => r.inboxIdDuplicates > 0).length}`,
  );
  console.log(
    `   🔄 Total duplicate inboxIds found: ${results.reduce((a, r) => a + r.inboxIdDuplicates, 0)}`,
  );
  console.log(
    `   🧹 Total records removed: ${results.reduce((a, r) => a + r.removed, 0)}`,
  );
  console.log(`\n🎉 Analysis & deduplication complete!`);
}

async function checkInstallations(client: Client, installationCount: number) {
  debugLog(`\n🔍 Checking installations for inbox: ${client.inboxId}`);
  const state = await client.preferences.inboxStateFromInboxIds(
    [client.inboxId],
    true,
  );
  let current = state?.[0]?.installations.length || 0;
  debugLog(`📊 Current installations: ${current}/${installationCount}`);
  const surplus = current - installationCount;
  if (surplus > 0) {
    debugLog(`🔄 Revoking ${surplus} surplus installations`);
    const all = state?.[0]?.installations || [];
    const toRevoke = all
      .slice(installationCount)
      .map(
        (inst) =>
          new Uint8Array(Buffer.from(inst.id.replace(/^0x/, ""), "hex")),
      );
    if (toRevoke.length) await client.revokeInstallations(toRevoke);
    debugLog(`✅ Successfully revoked ${toRevoke.length} installations`);
    current = installationCount;
  }
  return { client, currentInstallations: current };
}

async function smartUpdate({
  count,
  envs,
  installations,
}: {
  count?: number;
  envs?: XmtpEnv[];
  installations?: number;
}) {
  envs = envs || ["local"];
  const installationCount = installations || 2;
  if (envs.includes("local")) loadEnv("smart-update");
  debugLog(
    `\nConfiguration:\n- Environments: ${envs.join(", ")}\n- Installations per account: ${installationCount}\n- Target accounts: ${count || "all existing"}`,
  );
  const targetFileName = `${installationCount}.json`;
  const targetFilePath = `${INBOXES_DIR}/${targetFileName}`;
  let existingInboxes: InboxData[] =
    (readJson(targetFilePath) as InboxData[]) || [];
  const existingCount = existingInboxes.length;
  const targetCount = count || existingCount;
  const folderName = `db-generated-${installationCount}-${envs.join(",")}-${installationCount}inst`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(LOGPATH)) fs.mkdirSync(LOGPATH, { recursive: true });
  analyzeInboxFiles();
  let totalCreated = 0,
    totalFailed = 0;
  // Update existing accounts
  const accountsToProcess = Math.min(targetCount, existingCount);
  if (accountsToProcess > 0) {
    const updateProgress = new ProgressBar(accountsToProcess);
    for (let i = 0; i < targetCount; i++) {
      const inbox = existingInboxes[i];
      try {
        if (
          !inbox.walletKey ||
          !inbox.accountAddress ||
          !inbox.inboxId ||
          !inbox.dbEncryptionKey
        ) {
          totalFailed++;
          continue;
        }
        const signer = createSigner(inbox.walletKey as `0x${string}`);
        const dbEncryptionKey = getEncryptionKeyFromHex(inbox.dbEncryptionKey);
        for (const env of envs) {
          const client = await Client.create(signer, {
            dbEncryptionKey,
            dbPath: `${LOGPATH}/${env}-${inbox.accountAddress}-install-0`,
            env,
          });
          const { currentInstallations } = await checkInstallations(
            client,
            installationCount,
          );
          if (debugMode) {
            const installProgress = new ProgressBar(
              installationCount - currentInstallations,
            );
            for (let j = currentInstallations; j < installationCount; j++) {
              try {
                await Client.create(signer, {
                  dbEncryptionKey,
                  dbPath: `${LOGPATH}/${env}-${inbox.accountAddress}-install-${j}`,
                  env,
                });
                if (debugMode) {
                  process.stdout.write(
                    `\rCreated installation ${j} for ${inbox.accountAddress} in ${env} - `,
                  );
                }
                totalCreated++;
                installProgress.update();
              } catch {
                totalFailed++;
                installProgress.update();
              }
            }
            installProgress.finish();
          } else {
            for (let j = currentInstallations; j < installationCount; j++) {
              try {
                await Client.create(signer, {
                  dbEncryptionKey,
                  dbPath: `${LOGPATH}/${env}-${inbox.accountAddress}-install-${j}`,
                  env,
                });
                if (debugMode) {
                  process.stdout.write(
                    `\rCreated installation ${j} for ${inbox.accountAddress} in ${env} - `,
                  );
                }
                totalCreated++;
              } catch {
                totalFailed++;
              }
            }
          }
        }
        updateProgress.update();
        writeJson(targetFilePath, existingInboxes);
      } catch {
        totalFailed++;
        updateProgress.update();
      }
    }
    updateProgress.finish();
  }
  // Generate new accounts
  const newAccountsNeeded = Math.max(0, targetCount - accountsToProcess);
  if (newAccountsNeeded > 0) {
    const generateProgress = new ProgressBar(newAccountsNeeded);
    let consecutiveFailures = 0,
      MAX_FAILS = 3;
    for (let i = 0; i < newAccountsNeeded; i++) {
      if (consecutiveFailures >= MAX_FAILS) break;
      const walletKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
      try {
        const signer = createSigner(walletKey as `0x${string}`);
        const identifier = await signer.getIdentifier();
        const accountAddress = identifier.identifier;
        const dbEncryptionKey = generateEncryptionKeyHex();
        let inboxId = "";
        let installationsFailed = 0;
        for (const env of envs) {
          for (let j = 0; j < installationCount; j++) {
            try {
              const client = await Client.create(signer, {
                dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
                dbPath: `${LOGPATH}/${env}-${accountAddress}-install-${j}`,
                env,
              });
              if (j === 0 && env === envs[0]) inboxId = client.inboxId;
              totalCreated++;
            } catch {
              totalFailed++;
              installationsFailed++;
            }
          }
        }
        if (installationsFailed < installationCount * envs.length) {
          existingInboxes.push({
            accountAddress,
            walletKey,
            dbEncryptionKey,
            inboxId,
            installations: installationCount,
          });
          consecutiveFailures = 0;
          writeJson(targetFilePath, existingInboxes);
        } else {
          consecutiveFailures++;
        }
        generateProgress.update();
      } catch {
        totalFailed++;
        consecutiveFailures++;
        generateProgress.update();
      }
    }
    generateProgress.finish();
  }
  // Final cleanup and save
  const finalInboxes = removeDuplicates(existingInboxes);
  writeJson(targetFilePath, finalInboxes);
  console.log(
    `\nSummary:\n- Total accounts: ${finalInboxes.length}\n- Installations created: ${totalCreated}\n- Installations failed: ${totalFailed}\n- Data saved to: ${targetFilePath}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Parse arguments
  let count: number | undefined = undefined,
    envs: XmtpEnv[] | undefined = undefined,
    installations: string | undefined = undefined;

  args.forEach((arg, i) => {
    if (arg === "--count") count = parseInt(args[i + 1], 10);
    if (arg === "--envs")
      envs = args[i + 1]
        .split(",")
        .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
    if (arg === "--installations") installations = args[i + 1];
    if (arg === "--debug") debugMode = true;
  });

  if (count === undefined) count = DEFAULT_COUNT;
  if (envs === undefined) envs = DEFAULT_ENVS;

  // Handle cleanup
  if (!args.includes("--no-cleanup")) {
    cleanup();
  }

  // Handle comma-separated installations
  if (installations && (installations as string).includes(",")) {
    const installationList = (installations as string)
      .split(",")
      .map((i: string) => parseInt(i.trim(), 10));
    console.log(
      `🔄 Running for multiple installations: ${installationList.join(", ")}`,
    );

    for (const inst of installationList) {
      console.log(`\n--- Running for --installations ${inst} ---`);
      try {
        await runWithRetry(
          () => smartUpdate({ count, envs, installations: inst }),
          `installation ${inst}`,
        );
      } catch (error) {
        console.error(error);
        console.error(`❌ Failed for --installations ${inst}. Exiting.`);
        process.exit(1);
      }
    }
    console.log("✅ Completed all installation tests");
  } else {
    // Single installation value
    const installationCount = installations
      ? parseInt(installations, 10)
      : DEFAULT_INSTALLATIONS;
    await runWithRetry(
      () => smartUpdate({ count, envs, installations: installationCount }),
      "smart update",
    );
  }
}

main().catch(console.error);
