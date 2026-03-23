import * as crypto from "crypto";
import * as fs from "fs";
import { APP_VERSION } from "@helpers/client";
import { resolveEnvironment, type ExtendedXmtpEnv } from "@helpers/environment";
import { ProgressBar } from "@helpers/logger";
import { Client } from "@helpers/versions";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "../helpers/client";
import "dotenv/config";

const BASE_LOGPATH = "./logs";
const INBOXES_DIR = "./inboxes/byinstallation";
let debugMode = false;

// === Tweakable Defaults ===
const DEFAULT_COUNT = 200;
const DEFAULT_ENVS: ExtendedXmtpEnv[] = ["local"];
const DEFAULT_INSTALLATIONS = 2;
const MAX_RETRIES = 3;
// =========================

interface InboxData {
  accountAddress: string;
  walletKey: string;
  appVersion: string;
  disableDeviceSync: boolean;

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
  --env <environments>  Comma-separated environments (local,dev,production) [default: local]
  --installations <num>  Number of installations per inbox [default: 2]
  --restart             Force restart existing installations (revokes and recreates)
  --check               Check installation status without modifying (shows table)
  --debug               Enable debug logging
  --clean               Clean up logs/ and .data/ directories before running
  -h, --help            Show this help message

ENVIRONMENTS:
  local            Local XMTP network for development
  dev              Development XMTP network
  production       Production XMTP network
  testnet-staging  Staging testnet (use gateway from XMTP_GATEWAY_HOST environment variable)

EXAMPLES:
  yarn gen --count 500 --env local
  yarn gen --env local,dev --installations 3
  yarn gen --restart --env production --installations 2
  yarn gen --check --count 20 --env dev          Check status of first 20 inboxes
  yarn gen --clean --debug
  yarn gen --help

PRESET COMMANDS:
  yarn gen update:local      Update 500 inboxes for local testing
  yarn gen update:prod       Update inboxes for production testing
  yarn gen restart:prod      Restart production installations (force recreate)

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

async function checkInboxStatus({
  count,
  envs,
  installations,
}: {
  count: number;
  envs: ExtendedXmtpEnv[];
  installations: number;
}) {
  const targetFileName = `${installations}.json`;
  const targetFilePath = `${INBOXES_DIR}/${targetFileName}`;
  const existingInboxes: InboxData[] =
    (readJson(targetFilePath) as InboxData[]) || [];

  if (existingInboxes.length === 0) {
    console.error(`❌ No inboxes found in ${targetFilePath}`);
    return;
  }

  const inboxesToCheck = existingInboxes.slice(0, count);
  console.log(
    `\n🔍 Checking ${inboxesToCheck.length} inboxes from ${targetFileName} on ${envs.join(", ")}\n`,
  );

  for (const env of envs) {
    const resolved = resolveEnvironment(env);
    console.log(`\n📡 Environment: ${env}`);
    console.log("─".repeat(120));
    console.log(
      `${"#".padEnd(4)} ${"Inbox ID".padEnd(20)} ${"Address".padEnd(14)} ${"Installs".padEnd(10)} ${"Valid".padEnd(8)} ${"Invalid".padEnd(10)} ${"Status".padEnd(10)}`,
    );
    console.log("─".repeat(120));

    let totalValid = 0;
    let totalInvalid = 0;
    let totalMissing = 0;

    for (let i = 0; i < inboxesToCheck.length; i++) {
      const inbox = inboxesToCheck[i];
      try {
        const signer = createSigner(inbox.walletKey as `0x${string}`);
        const dbEncryptionKey = getEncryptionKeyFromHex(inbox.dbEncryptionKey);
        const tempDbPath = `${BASE_LOGPATH}/check-${env}-${inbox.accountAddress}`;

        const client = await Client.create(signer, {
          dbEncryptionKey,
          dbPath: tempDbPath,
          appVersion: APP_VERSION,
          disableDeviceSync: true,
          env: resolved.sdkEnv,
          gatewayHost: resolved.gatewayHost,
        });

        const states = await client.preferences.getInboxStates([inbox.inboxId]);
        const installs = states?.[0]?.installations || [];
        const installCount = installs.length;

        let validCount = 0;
        let invalidCount = 0;
        let status = "✅";

        if (installCount > 0) {
          try {
            const installationIds = installs.map(
              (inst: { id: string }) => inst.id,
            );
            const keyStatuses = (await client.fetchKeyPackageStatuses(
              installationIds,
            )) as Record<string, any>;

            for (const [, keyStatus] of Object.entries(keyStatuses)) {
              if (keyStatus?.validationError) {
                invalidCount++;
              } else if (keyStatus?.lifetime) {
                validCount++;
              }
            }

            if (invalidCount > 0) {
              status = "⚠️ Stale";
              totalInvalid += invalidCount;
            }
            if (validCount < installations) {
              status = "❌ Missing";
              totalMissing++;
            }
            if (validCount >= installations && invalidCount === 0) {
              status = "✅ OK";
            }
            totalValid += validCount;
          } catch {
            status = "❓ Error";
          }
        } else {
          status = "❌ None";
          totalMissing++;
        }

        const shortInboxId = `${inbox.inboxId.slice(0, 8)}...${inbox.inboxId.slice(-4)}`;
        const shortAddress = `${inbox.accountAddress.slice(0, 6)}...${inbox.accountAddress.slice(-4)}`;

        console.log(
          `${(i + 1).toString().padEnd(4)} ${shortInboxId.padEnd(20)} ${shortAddress.padEnd(14)} ${installCount.toString().padEnd(10)} ${validCount.toString().padEnd(8)} ${invalidCount.toString().padEnd(10)} ${status.padEnd(10)}`,
        );

        // Clean up temp db
        if (fs.existsSync(tempDbPath)) {
          fs.rmSync(tempDbPath, { recursive: true, force: true });
        }
      } catch (error) {
        const shortInboxId = `${inbox.inboxId.slice(0, 8)}...${inbox.inboxId.slice(-4)}`;
        const shortAddress = `${inbox.accountAddress.slice(0, 6)}...${inbox.accountAddress.slice(-4)}`;
        console.log(
          `${(i + 1).toString().padEnd(4)} ${shortInboxId.padEnd(20)} ${shortAddress.padEnd(14)} ${"?".padEnd(10)} ${"?".padEnd(8)} ${"?".padEnd(10)} ❌ Error`,
        );
      }
    }

    console.log("─".repeat(120));
    console.log(
      `\n📊 Summary for ${env}: ${totalValid} valid, ${totalInvalid} invalid/stale, ${totalMissing} missing installations`,
    );
    if (totalInvalid > 0 || totalMissing > 0) {
      console.log(
        `💡 Run: yarn gen --installations ${installations} --count ${count} --restart --env ${env}`,
      );
    }
  }
}

async function checkInstallations(
  client: Client,
  installationCount: number,
  forceRestart: boolean = false,
) {
  debugLog(`\n🔍 Checking installations for inbox: ${client.inboxId}`);
  const state = await client.preferences.fetchInboxStates([client.inboxId]);
  let current = state?.[0]?.installations.length || 0;
  debugLog(`📊 Current installations: ${current}/${installationCount}`);

  if (forceRestart && current > 0) {
    debugLog(`🔄 Force restart: Revoking ALL ${current} installations`);
    const all = state?.[0]?.installations || [];
    const toRevoke = all.map(
      (inst: { id: string }) =>
        new Uint8Array(Buffer.from(inst.id.replace(/^0x/, ""), "hex")),
    );
    if (toRevoke.length) await client.revokeInstallations(toRevoke);
    debugLog(
      `✅ Successfully revoked ${toRevoke.length} installations for restart`,
    );
    current = 0; // Reset to 0 since we revoked all
  } else {
    const surplus = current - installationCount;
    if (surplus > 0) {
      debugLog(`🔄 Revoking ${surplus} surplus installations`);
      const all = state?.[0]?.installations || [];
      const toRevoke = all
        .slice(installationCount)
        .map(
          (inst: { id: string }) =>
            new Uint8Array(Buffer.from(inst.id.replace(/^0x/, ""), "hex")),
        );
      if (toRevoke.length) await client.revokeInstallations(toRevoke);
      debugLog(`✅ Successfully revoked ${toRevoke.length} installations`);
      current = installationCount;
    }
  }
  return { client, currentInstallations: current };
}

async function smartUpdate({
  count,
  envs,
  installations,
  restart,
}: {
  count?: number;
  envs?: ExtendedXmtpEnv[];
  installations?: number;
  restart?: boolean;
}) {
  envs = envs || ["local"];
  const installationCount = installations || 2;
  if (envs.includes("local")) loadEnv("smart-update");
  debugLog(
    `\nConfiguration:\n- Environments: ${envs.join(", ")}\n- Installations per account: ${installationCount}\n- Target accounts: ${count || "all existing"}\n- Restart mode: ${restart ? "enabled (force recreate)" : "disabled"}`,
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
          const resolved = resolveEnvironment(env);
          const client = await Client.create(signer, {
            dbEncryptionKey,
            dbPath: `${LOGPATH}/${env}-${inbox.accountAddress}-install-0`,
            appVersion: APP_VERSION,
            disableDeviceSync: true,
            env: resolved.sdkEnv,
            gatewayHost: resolved.gatewayHost,
          });
          const { currentInstallations } = await checkInstallations(
            client,
            installationCount,
            restart || false,
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
                  env: resolved.sdkEnv,
                  gatewayHost: resolved.gatewayHost,
                  appVersion: APP_VERSION,
                  disableDeviceSync: true,
                });
                if (debugMode) {
                  process.stdout.write(
                    `\rCreated installation ${j} for ${inbox.accountAddress} in ${env} - `,
                  );
                }
                totalCreated++;
                installProgress.update();
              } catch (error) {
                console.error(
                  `Failed to create installation ${j} for ${inbox.accountAddress} in ${env}:`,
                  error instanceof Error ? error.message : String(error),
                );
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
                  env: resolved.sdkEnv,
                  gatewayHost: resolved.gatewayHost,
                  appVersion: APP_VERSION,
                  disableDeviceSync: true,
                });
                if (debugMode) {
                  process.stdout.write(
                    `\rCreated installation ${j} for ${inbox.accountAddress} in ${env} - `,
                  );
                }
                totalCreated++;
              } catch (error) {
                console.error(
                  `Failed to create installation ${j} for ${inbox.accountAddress} in ${env}:`,
                  error instanceof Error ? error.message : String(error),
                );
                totalFailed++;
              }
            }
          }
        }
        updateProgress.update();
        writeJson(targetFilePath, existingInboxes);
      } catch (error) {
        console.error(
          `Failed to process account ${inbox?.accountAddress || "unknown"}:`,
          error instanceof Error ? error.message : String(error),
        );
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
          const resolved = resolveEnvironment(env);
          for (let j = 0; j < installationCount; j++) {
            try {
              const client = await Client.create(signer, {
                dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
                dbPath: `${LOGPATH}/${env}-${accountAddress}-install-${j}`,
                env: resolved.sdkEnv,
                gatewayHost: resolved.gatewayHost,
                appVersion: APP_VERSION,
                disableDeviceSync: true,
              });
              if (j === 0 && env === envs[0]) inboxId = client.inboxId;
              totalCreated++;
            } catch (error) {
              console.error(
                `Failed to create installation ${j} for new account ${accountAddress} in ${env}:`,
                error instanceof Error ? error.message : String(error),
              );
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
            appVersion: APP_VERSION,
            disableDeviceSync: true,
          });
          consecutiveFailures = 0;
          writeJson(targetFilePath, existingInboxes);
        } else {
          consecutiveFailures++;
        }
        generateProgress.update();
      } catch (error) {
        console.error(
          `Failed to generate new account:`,
          error instanceof Error ? error.message : String(error),
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
    envs: ExtendedXmtpEnv[] | undefined = undefined,
    installations: string | undefined = undefined,
    restart = false,
    check = false;

  args.forEach((arg, i) => {
    if (arg === "--count") count = parseInt(args[i + 1], 10);
    if (arg === "--env")
      envs = args[i + 1]
        .split(",")
        .map((e) => e.trim().toLowerCase()) as ExtendedXmtpEnv[];
    if (arg === "--installations") installations = args[i + 1];
    if (arg === "--restart") restart = true;
    if (arg === "--check") check = true;
    if (arg === "--debug") debugMode = true;
  });

  if (count === undefined) count = DEFAULT_COUNT;
  if (envs === undefined) envs = DEFAULT_ENVS;

  // Handle check mode (read-only, shows status table)
  if (check) {
    const installationCount = installations
      ? parseInt(installations, 10)
      : DEFAULT_INSTALLATIONS;
    await checkInboxStatus({
      count,
      envs,
      installations: installationCount,
    });
    return;
  }

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
          () => smartUpdate({ count, envs, installations: inst, restart }),
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
      () =>
        smartUpdate({ count, envs, installations: installationCount, restart }),
      "smart update",
    );
  }
}

main().catch(console.error);
