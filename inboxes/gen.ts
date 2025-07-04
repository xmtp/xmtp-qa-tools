import * as crypto from "crypto";
import * as fs from "fs";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const BASE_LOGPATH = "./logs";
const INBOXES_DIR = "./inboxes";
const INSTALLATIONS_DIR = "./inboxes/installations";
let debugMode = false;

// === Tweakable Defaults ===
const DEFAULT_COUNT = 200;
const DEFAULT_ENVS: XmtpEnv[] = ["local"];
const DEFAULT_INSTALLATIONS = 2;
const DEFAULT_INSTALLATIONS_COUNT = 2;
const DEFAULT_GROUPS_PER_INSTALLATION = 200;
const DEFAULT_CONVERSATIONS_PER_GROUP = 200;
// =========================

interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
}

interface InstallationData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installationId: string;
  dbPath: string;
  env: XmtpEnv;
  groupsCreated: number;
  conversationsCreated: number;
}

const debugLog = (...args: unknown[]) => {
  if (debugMode) console.log(...args);
};

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

function showHelp() {
  console.log(
    `\nXMTP Generator Utility\n\nUsage:\n  yarn gen [options]\n\nOptions:\n  --count <number>                Total number of accounts to ensure exist\n  --envs <envs>                   Comma-separated environments (local,dev,production) (default: local)\n  --installations <number>        Number of installations per account per network (default: 1)\n  --create-installations <number> Create installations with populated databases (default: 10)\n  --groups-per-installation <number> Number of groups per installation (default: 200)\n  --conversations-per-group <number> Number of conversations per group (default: 200)\n  --debug                         Enable debug logging\n  --help                          Show this help message\n`,
  );
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

async function createGroupsAndConversations(
  client: Client,
  targetGroups: number,
  conversationsPerGroup: number,
  allInboxes: InboxData[],
): Promise<{ groupsCreated: number; conversationsCreated: number }> {
  let groupsCreated = 0;
  let conversationsCreated = 0;

  await client.conversations.sync();
  const progress = new ProgressBar(targetGroups);

  for (let i = 0; i < targetGroups; i++) {
    try {
      const groupSize = Math.floor(Math.random() * 4) + 2;
      const randomInboxes = allInboxes
        .filter((inbox) => inbox.inboxId !== client.inboxId)
        .sort(() => 0.5 - Math.random())
        .slice(0, groupSize - 1)
        .map((inbox) => inbox.inboxId);

      const group = await client.conversations.newGroup(randomInboxes, {
        groupName: `Test Group ${i + 1}`,
        groupDescription: `Auto-generated test group ${i + 1}`,
      });

      groupsCreated++;

      for (let j = 0; j < conversationsPerGroup; j++) {
        try {
          await group.send(`Message ${j + 1} in Test Group ${i + 1}`);
          conversationsCreated++;
        } catch (error) {
          debugLog(`Failed to send message ${j + 1}:`, error);
        }
      }

      progress.update();
    } catch (error) {
      debugLog(`Failed to create group ${i + 1}:`, error);
      progress.update();
    }
  }

  progress.finish();
  return { groupsCreated, conversationsCreated };
}

async function generateInstallationsWithContent({
  count = DEFAULT_INSTALLATIONS_COUNT,
  env = "local" as XmtpEnv,
  groupsPerInstallation = DEFAULT_GROUPS_PER_INSTALLATION,
  conversationsPerGroup = DEFAULT_CONVERSATIONS_PER_GROUP,
}: {
  count?: number;
  env?: XmtpEnv;
  groupsPerInstallation?: number;
  conversationsPerGroup?: number;
}) {
  if (env === "local") loadEnv("installation-generation");

  console.log(
    `\n🚀 Generating ${count} installations with ${groupsPerInstallation} groups, ${conversationsPerGroup} conversations each`,
  );

  if (!fs.existsSync(INSTALLATIONS_DIR)) {
    fs.mkdirSync(INSTALLATIONS_DIR, { recursive: true });
  }

  // Load existing inboxes for group members
  const inboxFiles = ["5.json", "25.json", "20.json", "15.json", "10.json"];
  let allInboxes: InboxData[] = [];

  for (const file of inboxFiles) {
    const inboxes = readJson(`${INBOXES_DIR}/${file}`);
    if (inboxes && inboxes.length > 0) {
      allInboxes = inboxes;
      break;
    }
  }

  if (allInboxes.length < 10) {
    console.error(
      "❌ Not enough existing inboxes found. Please run 'yarn gen --count 100' first.",
    );
    return;
  }

  const installations: InstallationData[] = [];
  const progress = new ProgressBar(count);

  for (let i = 0; i < count; i++) {
    try {
      const walletKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
      const signer = createSigner(walletKey as `0x${string}`);
      const identifier = await signer.getIdentifier();
      const accountAddress = identifier.identifier;
      const dbEncryptionKey = generateEncryptionKeyHex();
      const dbPath = `${INSTALLATIONS_DIR}/installation-${i + 1}-${env}`;

      const client = await Client.create(signer, {
        dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
        dbPath,
        env,
      });

      const { groupsCreated, conversationsCreated } =
        await createGroupsAndConversations(
          client,
          groupsPerInstallation,
          conversationsPerGroup,
          allInboxes,
        );

      installations.push({
        accountAddress,
        walletKey,
        dbEncryptionKey,
        inboxId: client.inboxId,
        installationId: client.installationId,
        dbPath,
        env,
        groupsCreated,
        conversationsCreated,
      });

      progress.update();
      debugLog(
        `✅ Installation ${i + 1}: ${groupsCreated} groups, ${conversationsCreated} conversations`,
      );
    } catch (error) {
      console.error(`❌ Failed to create installation ${i + 1}:`, error);
      progress.update();
    }
  }

  progress.finish();

  const installationsFile = `${INSTALLATIONS_DIR}/installations-${env}.json`;
  writeJson(installationsFile, installations);

  const totalGroups = installations.reduce(
    (sum, inst) => sum + inst.groupsCreated,
    0,
  );
  const totalConversations = installations.reduce(
    (sum, inst) => sum + inst.conversationsCreated,
    0,
  );

  console.log(
    `\n✅ Created ${installations.length} installations with ${totalGroups} groups and ${totalConversations} conversations`,
  );
  console.log(`📁 Files saved to: ${INSTALLATIONS_DIR}/`);

  return installations;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  let count: number | undefined = undefined,
    envs: XmtpEnv[] | undefined = undefined,
    installations: number | undefined = undefined,
    createInstallations: number | undefined = undefined,
    groupsPerInstallation: number | undefined = undefined,
    conversationsPerGroup: number | undefined = undefined;

  args.forEach((arg, i) => {
    if (arg === "--count") count = parseInt(args[i + 1], 10);
    if (arg === "--envs")
      envs = args[i + 1]
        .split(",")
        .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
    if (arg === "--installations") installations = parseInt(args[i + 1], 10);
    if (arg === "--create-installations")
      createInstallations = parseInt(args[i + 1], 10);
    if (arg === "--groups-per-installation")
      groupsPerInstallation = parseInt(args[i + 1], 10);
    if (arg === "--conversations-per-group")
      conversationsPerGroup = parseInt(args[i + 1], 10);
    if (arg === "--debug") debugMode = true;
  });

  // If --create-installations is specified, run the new functionality
  if (
    createInstallations !== undefined ||
    args.includes("--create-installations")
  ) {
    const env = envs?.[0] || "local";
    const installationCount =
      createInstallations || DEFAULT_INSTALLATIONS_COUNT;
    await generateInstallationsWithContent({
      count: installationCount,
      env,
      groupsPerInstallation:
        groupsPerInstallation || DEFAULT_GROUPS_PER_INSTALLATION,
      conversationsPerGroup:
        conversationsPerGroup || DEFAULT_CONVERSATIONS_PER_GROUP,
    });
    return;
  }

  // Otherwise, run the existing functionality
  if (count === undefined) count = DEFAULT_COUNT;
  if (envs === undefined) envs = DEFAULT_ENVS;
  if (installations === undefined) installations = DEFAULT_INSTALLATIONS;
  await smartUpdate({ count, envs, installations });
}

main().catch(console.error);
