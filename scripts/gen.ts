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

function showHelp() {
  console.log(`
XMTP Generator Utility

Usage:
  yarn gen --mode <mode> [options]

Modes:
  --mode generate-inboxes         Generate new XMTP inboxes
  --mode local-update             Initialize local inboxes from a JSON file
  --mode generate-installations   Generate multiple installations for a single account

Options for generate-inboxes:
  --count <number>                Number of accounts to generate
  --envs <envs>                   Comma-separated environments (local,dev,production)
  --output <file>                 Output file (default: logs/db-generated-...)

Options for local-update:
  --input <file>                  Input JSON file (default: @helpers/inboxes.json)
  --env <env>                     Environment (default: local)

Options for generate-installations:
  --privateKey <key>              Private key (0x...)
  --encryptionKey <key>           Encryption key (hex)
  --count <number>                Number of installations
  --env <env>                     Environment (default: dev)
  --output <file>                 Output file (default: logs/generated-installations.json)

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
  output?: string;
}) {
  let { count, envs, output } = opts;
  if (!count) count = await askForAccountCount();
  if (!envs) envs = await askForEnvironments();

  console.log(`Using environments: ${envs.join(", ")}`);
  const folderName = `db-generated-${count}-${envs.join(",")}`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(`${LOGPATH}${DB_PATH}`)) {
    console.log(`Creating directory: ${LOGPATH}...`);
    fs.mkdirSync(`${LOGPATH}${DB_PATH}`, { recursive: true });
  }
  const accountData = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = output || `${LOGPATH}/inboxes-${timestamp}.json`;

  for (let i = 0; i < count; i++) {
    const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
    try {
      const signer = createSigner(privateKey as `0x${string}`);
      const identifier = await signer.getIdentifier();
      const accountAddress = identifier.identifier;
      const dbEncryptionKey = generateEncryptionKeyHex();
      let inboxId = "";
      for (const env of envs) {
        const client = await Client.create(signer, {
          dbEncryptionKey: getEncryptionKeyFromHex(dbEncryptionKey),
          dbPath: `${LOGPATH}${DB_PATH}/${env}-${accountAddress}`,
          env: env,
        });
        inboxId = client.inboxId;
        console.log(
          `Created client in ${env} environment for account ${i + 1}/${count}: ${accountAddress}`,
        );
      }
      accountData.push({
        accountAddress,
        privateKey,
        dbEncryptionKey,
        inboxId,
      });
      fs.writeFileSync(outputFile, JSON.stringify(accountData, null, 2));
    } catch (error: unknown) {
      console.error(`Error creating XMTP client for account ${i + 1}:`, error);
    }
  }
  console.log(
    `Successfully generated ${accountData.length} accounts with XMTP clients`,
  );
  console.log(`Data saved to ${outputFile}`);
  console.log(`All data stored in folder: ${LOGPATH}`);
}

async function localUpdate(opts: { input?: string; env?: XmtpEnv }) {
  let inputFile: string;
  if (opts.input) {
    inputFile = opts.input;
  } else {
    // Use require.resolve only if it returns a string
    try {
      inputFile = require.resolve("@helpers/inboxes.json");
    } catch {
      inputFile = "helpers/inboxes.json";
    }
  }
  const ENV: XmtpEnv = opts.env || "local";
  loadEnv("local-update");
  let generatedInboxes;
  try {
    generatedInboxes = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  } catch (e) {
    console.log(e);
    console.error(`Could not read input file: ${inputFile}`);
    return;
  }
  if (!generatedInboxes || generatedInboxes.length === 0) {
    console.error("No generated inboxes found in input file");
    return;
  }
  const folderName = `db-generated-${generatedInboxes.length}-${ENV}`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  if (!fs.existsSync(LOGPATH)) {
    console.log(`Creating directory: ${LOGPATH}...`);
    fs.mkdirSync(LOGPATH, { recursive: true });
  }
  const results = { success: 0, failed: 0, inboxIds: [] as string[] };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = `${LOGPATH}/local-inboxes-${timestamp}.json`;
  const accountData = [];
  for (let i = 0; i < generatedInboxes.length; i++) {
    const inbox = generatedInboxes[i];
    try {
      const signer = createSigner(inbox.privateKey as `0x${string}`);
      const dbEncryptionKey = getEncryptionKeyFromHex(
        inbox.dbEncryptionKey as string,
      );
      const dbPath = `${LOGPATH}/${ENV}-${inbox.accountAddress}`;
      console.log(
        `Initializing inbox ${i + 1}/${generatedInboxes.length}: ${inbox.accountAddress}`,
      );
      console.log(`Using database path: ${dbPath}`);
      const client = await Client.create(signer, {
        dbEncryptionKey,
        dbPath: dbPath,
        env: ENV,
      });
      if (client.inboxId !== inbox.inboxId) {
        console.warn(`Warning: Inbox ID mismatch for ${inbox.accountAddress}`);
        console.warn(`  Expected: ${inbox.inboxId}`);
        console.warn(`  Actual: ${client.inboxId}`);
      }
      accountData.push({
        accountAddress: inbox.accountAddress,
        inboxId: client.inboxId,
        privateKey: inbox.privateKey,
        dbEncryptionKey: inbox.dbEncryptionKey || inbox.encryptionKey,
        dbPath: dbPath,
      });
      fs.writeFileSync(outputFile, JSON.stringify(accountData, null, 2));
      results.success++;
      results.inboxIds.push(client.inboxId);
      console.log(
        `✅ Successfully initialized address: ${inbox.accountAddress}`,
      );
      console.log(`✅ Successfully initialized inbox: ${client.inboxId}`);
    } catch (error) {
      results.failed++;
      console.error(`❌ Error initializing inbox ${inbox.accountAddress}:`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
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

async function generateInstallations(opts: {
  privateKey?: string;
  encryptionKey?: string;
  count?: number;
  env?: XmtpEnv;
  output?: string;
}) {
  let { privateKey, encryptionKey, count, env, output } = opts;
  if (!privateKey) privateKey = await ask("Enter private key (0x...): ");
  if (!encryptionKey) encryptionKey = await ask("Enter encryption key (hex): ");
  if (!count) count = parseInt(await ask("How many installations? "), 10);
  if (!env)
    env = (
      await ask("Enter environment (local,dev,production): ")
    ).toLowerCase() as XmtpEnv;
  if (!validEnvironments.includes(env)) env = "dev";
  const signer = createSigner(privateKey as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);
  const installationData = [];
  let accountAddress = "";
  try {
    const identifier = await signer.getIdentifier();
    accountAddress = identifier.identifier;
    console.log(`Using account address: ${accountAddress}`);
    for (let i = 0; i < count; i++) {
      const client = await Client.create(signer, {
        dbEncryptionKey,
        env,
      });
      const inboxId = client.inboxId;
      const installationId = client.installationId;
      installationData.push({
        accountAddress,
        inboxId,
        installationId,
        env,
        installationIndex: i,
      });
      const outputFile = output || `./logs/generated-installations.json`;
      fs.writeFileSync(outputFile, JSON.stringify(installationData, null, 2));
      console.log(`Created installation ${i + 1}/${count}: ${installationId}`);
    }
  } catch (error: unknown) {
    console.error(`Error creating XMTP clients:`, error);
  }
  console.log(
    `Successfully generated ${installationData.length} XMTP clients for account ${accountAddress}`,
  );
  console.log(
    `Data saved to ${output || "./logs/generated-installations.json"}`,
  );
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
    let output: string | undefined;
    args.forEach((arg, i) => {
      if (arg === "--count") count = parseInt(args[i + 1], 10);
      if (arg === "--envs")
        envs = args[i + 1]
          .split(",")
          .map((e) => e.trim().toLowerCase()) as XmtpEnv[];
      if (arg === "--output") output = args[i + 1];
    });
    await generateInboxes({ count, envs, output });
  } else if (mode === "local-update") {
    let input: string | undefined;
    let env: XmtpEnv | undefined;
    args.forEach((arg, i) => {
      if (arg === "--input") input = args[i + 1];
      if (arg === "--env") env = args[i + 1] as XmtpEnv;
    });
    await localUpdate({ input, env });
  } else if (mode === "generate-installations") {
    let privateKey: string | undefined;
    let encryptionKey: string | undefined;
    let count: number | undefined;
    let env: XmtpEnv | undefined;
    let output: string | undefined;
    args.forEach((arg, i) => {
      if (arg === "--privateKey") privateKey = args[i + 1];
      if (arg === "--encryptionKey") encryptionKey = args[i + 1];
      if (arg === "--count") count = parseInt(args[i + 1], 10);
      if (arg === "--env") env = args[i + 1] as XmtpEnv;
      if (arg === "--output") output = args[i + 1];
    });
    await generateInstallations({
      privateKey,
      encryptionKey,
      count,
      env,
      output,
    });
  } else {
    showHelp();
  }
}

main().catch(console.error);
