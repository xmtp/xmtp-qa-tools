import * as crypto from "crypto";
import * as fs from "fs";
import * as readline from "readline";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
  loadEnv,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const BASE_LOGPATH = "./logs";
const DB_PATH = "/db";
const validEnvironments = ["local", "dev", "production"] as XmtpEnv[];

// Type definitions for inbox data
interface InboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey: string;
  inboxId: string;
  installations: number;
}

interface LocalInboxData extends InboxData {
  dbPath?: string;
}

// Type for reading existing inbox data (may have legacy field names)
interface ExistingInboxData {
  accountAddress: string;
  walletKey: string;
  dbEncryptionKey?: string;
  inboxId: string;
  installations?: number;
}

function showHelp() {
  console.log(`
XMTP Generator Utility

Usage:
  yarn gen --mode <mode> [options]

Modes:
  --mode generate-inboxes         Generate new XMTP inboxes with optional installations
  --mode local-update             Initialize local inboxes from helpers/inboxes.json (uses defaults)

Options for generate-inboxes:
  --count <number>                Number of accounts to generate
  --envs <envs>                   Comma-separated environments (local,dev,production)
  --installations <number>        Number of installations per account per network (default: 1)
  --output <file>                 Output file (default: logs/db-generated-...)

Options for local-update:
  --installations <number>        Number of installations to create per account (overrides JSON file value)

  --help                          Show this help message
`);
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(question: string): Promise<string> {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function askForAccountCount(): Promise<number> {
  const answer = await ask(`How many accounts would you like to generate? `);
  const count = parseInt(answer, 10);
  if (isNaN(count) || count <= 0) {
    console.log("Invalid input. Please enter a positive number.");
    return askForAccountCount();
  }
  return count;
}

async function askForEnvironments(): Promise<XmtpEnv[]> {
  const answer = await ask(
    `Enter XMTP environments to use (comma-separated: local,dev,production): `,
  );
  const envs = answer.split(",").map((e) => e.trim().toLowerCase());
  const validEnvs = envs.filter((env) =>
    validEnvironments.includes(env as XmtpEnv),
  );
  if (validEnvs.length === 0) {
    console.log("No valid environments provided. Using 'local' as default.");

    return ["local", "dev", "production"] as XmtpEnv[];
  }
  return validEnvs as XmtpEnv[];
}

async function generateInboxes(opts: {
  count?: number;
  envs?: XmtpEnv[];
  installations?: number;
  output?: string;
}) {
  let { count, envs, installations, output } = opts;
  if (!count) count = await askForAccountCount();
  if (!envs) envs = await askForEnvironments();
  const installationCount = installations || 1;

  console.log(`Using environments: ${envs.join(", ")}`);
  console.log(
    `Creating ${installationCount} installations per account per network`,
  );
  const folderName = `db-generated-${count}-${envs.join(",")}-${installationCount}inst`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(`${LOGPATH}${DB_PATH}`)) {
    console.log(`Creating directory: ${LOGPATH}...`);
    fs.mkdirSync(`${LOGPATH}${DB_PATH}`, { recursive: true });
  }
  const accountData: InboxData[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = output || `${LOGPATH}/inboxes-${timestamp}.json`;

  let totalCreated = 0;
  let totalFailed = 0;

  for (let i = 0; i < count; i++) {
    const walletKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
    try {
      const signer = createSigner(walletKey as `0x${string}`);
      const identifier = await signer.getIdentifier();
      const accountAddress = identifier.identifier;
      const dbEncryptionKey = generateEncryptionKeyHex();
      let inboxId = "";

      console.log(`\nProcessing account ${i + 1}/${count}: ${accountAddress}`);

      // Create installations for each environment
      for (const env of envs) {
        console.log(
          `  Creating ${installationCount} installations on ${env}...`,
        );

        for (let j = 0; j < installationCount; j++) {
          try {
            const client = await Client.create(signer, {
              dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
              dbPath: `${LOGPATH}${DB_PATH}/${env}-${accountAddress}-install-${j}`,
              env: env,
            });

            if (j === 0) {
              inboxId = client.inboxId; // Use the first installation's inboxId
            }

            console.log(
              `    Created installation ${j + 1}/${installationCount}: ${client.installationId}`,
            );
            totalCreated++;
          } catch (error) {
            console.error(
              `    Failed to create installation ${j + 1}/${installationCount}:`,
              error instanceof Error ? error.message : String(error),
            );
            totalFailed++;
          }
        }
      }

      accountData.push({
        accountAddress,
        walletKey,
        dbEncryptionKey,
        inboxId,
        installations: installationCount,
      });
      fs.writeFileSync(outputFile, JSON.stringify(accountData, null, 2));
    } catch (error: unknown) {
      console.error(`Error processing account ${i + 1}:`, error);
    }
  }

  console.log(`\n=== Generation Summary ===`);
  console.log(`Successfully generated ${accountData.length} accounts`);
  console.log(
    `Target installations per account per network: ${installationCount}`,
  );
  console.log(`Total installations created: ${totalCreated}`);
  console.log(`Total installations failed: ${totalFailed}`);
  console.log(`Data saved to ${outputFile}`);
  console.log(`All data stored in folder: ${LOGPATH}`);
}

async function localUpdate(opts: { installations?: number } = {}) {
  // Use defaults only - no options
  const ENV: XmtpEnv = "local";
  const { installations: overrideInstallations } = opts;

  loadEnv("local-update");

  const inboxesDir = "./inboxes";
  let filesToProcess: string[] = [];

  if (overrideInstallations) {
    // Process only the specific file that matches the installations number
    const targetFile = `${inboxesDir}/${overrideInstallations}.json`;
    if (fs.existsSync(targetFile)) {
      filesToProcess = [targetFile];
    } else {
      console.error(
        `File ${overrideInstallations}.json not found in ${inboxesDir}`,
      );
      return;
    }
  } else {
    // Scan for inbox JSON files (numbered files like 25.json, 5.json, etc.)
    filesToProcess = fs
      .readdirSync(inboxesDir)
      .filter((file) => file.endsWith(".json"))
      .filter((file) => /^\d+\.json$/.test(file)) // Only files that are numbers.json
      .map((file) => `${inboxesDir}/${file}`); // Add full path

    if (filesToProcess.length === 0) {
      console.error(
        "No inbox JSON files found (looking for files like 25.json, 5.json, etc.)",
      );
      return;
    }
  }

  const fileNames = filesToProcess.map((f) => f.replace(`${inboxesDir}/`, ""));
  console.log(
    `Processing ${filesToProcess.length} inbox file(s): ${fileNames.join(", ")}`,
  );
  if (overrideInstallations) {
    console.log(`Using installations count: ${overrideInstallations}`);
  }

  // Process each selected file
  for (const inputFile of filesToProcess) {
    console.log(`\n=== Processing ${inputFile} ===`);

    let generatedInboxes: ExistingInboxData[];
    try {
      generatedInboxes = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    } catch (e) {
      console.log(e);
      console.error(`Could not read input file: ${inputFile}`);
      continue;
    }
    if (!generatedInboxes || generatedInboxes.length === 0) {
      console.error(`No generated inboxes found in input file: ${inputFile}`);
      continue;
    }
    const fileName = inputFile
      .replace(`${inboxesDir}/`, "")
      .replace(".json", "");
    const folderName = `db-generated-${fileName}-${generatedInboxes.length}-${ENV}`;
    const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
    if (!fs.existsSync(LOGPATH)) {
      console.log(`Creating directory: ${LOGPATH}...`);
      fs.mkdirSync(LOGPATH, { recursive: true });
    }
    const results = { success: 0, failed: 0, inboxIds: [] as string[] };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFile = `${LOGPATH}/local-inboxes-${timestamp}.json`;
    const accountData: LocalInboxData[] = [];
    for (let i = 0; i < generatedInboxes.length; i++) {
      const inbox = generatedInboxes[i];
      try {
        if (!inbox.walletKey || !inbox.accountAddress || !inbox.inboxId) {
          console.error(
            `❌ Invalid inbox data for account ${i + 1}: missing required fields`,
          );
          results.failed++;
          continue;
        }

        const encryptionKey = inbox.dbEncryptionKey;
        if (!encryptionKey) {
          console.error(
            `❌ Invalid inbox data for account ${i + 1}: missing encryption key`,
          );
          results.failed++;
          continue;
        }

        const installationCount =
          overrideInstallations || inbox.installations || 1;
        const signer = createSigner(inbox.walletKey as `0x${string}`);
        const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);

        console.log(
          `Initializing inbox ${i + 1}/${generatedInboxes.length}: ${inbox.accountAddress}`,
        );
        console.log(`Creating ${installationCount} installations...`);

        let firstClient = await Client.create(signer, {
          dbEncryptionKey,
          dbPath: `${LOGPATH}/${ENV}-${inbox.accountAddress}-install-0`,
          env: ENV,
        });
        const state = await firstClient?.preferences.inboxState();
        const currentInstallations = state?.installations.length;
        console.log(`${i} Current installations: ${currentInstallations}`);
        console.log(`${i} Installation count: ${installationCount}`);
        for (let j = currentInstallations; j < installationCount; j++) {
          try {
            const dbPath = `${LOGPATH}/${ENV}-${inbox.accountAddress}-install-${j}`;
            console.log(
              `  Creating installation ${j + 1}/${installationCount}`,
            );
            console.log(`  Using database path: ${dbPath}`);

            const client = await Client.create(signer, {
              dbEncryptionKey,
              dbPath: dbPath,
              env: ENV,
            });

            if (j === 0) {
              firstClient = client; // Use the first installation for verification
            }

            console.log(
              `  ✅ Created installation ${j + 1}/${installationCount}/${i}: ${client.installationId} `,
            );
            results.success++;
          } catch (error) {
            console.error(
              `  ❌ Failed to create installation ${j + 1}/${installationCount}:`,
              error instanceof Error ? error.message : String(error),
            );
            results.failed++;
          }
        }

        if (firstClient) {
          if (firstClient.inboxId !== inbox.inboxId) {
            console.warn(
              `Warning: Inbox ID mismatch for ${inbox.accountAddress}`,
            );
            console.warn(`  Expected: ${inbox.inboxId}`);
            console.warn(`  Actual: ${firstClient.inboxId}`);
          }

          accountData.push({
            accountAddress: inbox.accountAddress,
            inboxId: firstClient.inboxId,
            walletKey: inbox.walletKey,
            dbEncryptionKey: encryptionKey,
            dbPath: `${LOGPATH}/${ENV}-${inbox.accountAddress}-install-0`, // Base path for first installation
            installations: installationCount,
          });
          fs.writeFileSync(outputFile, JSON.stringify(accountData, null, 2));
          results.inboxIds.push(firstClient.inboxId);
          console.log(
            `✅ Successfully initialized address: ${inbox.accountAddress}`,
          );
          console.log(
            `✅ Successfully initialized inbox: ${firstClient.inboxId}`,
          );
        }
      } catch (error) {
        results.failed++;
        console.error(`❌ Error initializing inbox ${inbox.accountAddress}:`);
        console.error(error instanceof Error ? error.message : String(error));
      }
    }
    console.log(`\n=== Summary for ${inputFile} ===`);
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

  console.log("\n=== Overall Local Inbox Update Complete ===");
  console.log(`Processed ${filesToProcess.length} files successfully.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }
  const modeIdx = args.findIndex((a) => a === "--mode");
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : undefined;
  if (!mode) {
    showHelp();
    return;
  }
  if (mode === "generate-inboxes") {
    let count: number | undefined;
    let envs: XmtpEnv[] | undefined;
    let installations: number | undefined;
    let output: string | undefined;
    args.forEach((arg, i) => {
      if (arg === "--count") count = parseInt(args[i + 1], 10);
      if (arg === "--envs")
        envs = args[i + 1]
          .split(",")
          .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
      if (arg === "--installations") installations = parseInt(args[i + 1], 10);
      if (arg === "--output") output = args[i + 1];
    });
    await generateInboxes({ count, envs, installations, output });
  } else if (mode === "local-update") {
    let installations: number | undefined;
    args.forEach((arg, i) => {
      if (arg === "--installations") installations = parseInt(args[i + 1], 10);
    });
    await localUpdate({ installations });
  } else {
    showHelp();
  }
}

main().catch(console.error);
