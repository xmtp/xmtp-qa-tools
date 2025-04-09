import * as fs from "fs";
import * as readline from "readline";
import {
  createSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@helpers/types";

const BASE_LOGPATH = "./logs";
const DB_PATH = "/db";
// Define valid XMTP environments
const validEnvironments = ["local", "dev", "production"] as XmtpEnv[];

// Function to display help
function showHelp() {
  console.log(`
XMTP Account Generator

Usage:
  yarn generate 

Arguments:
  count         Number of accounts to generate (default: prompted)
  environments  Comma-separated list of XMTP environments (local,dev,production)

This will generate folder inside /logs/db-generated-{count}-{environments} folder with the name of the number of accounts and the environments.
`);
}

// Function to create a readline interface for user input
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Function to ask for number of accounts to generate
async function askForAccountCount(): Promise<number> {
  const rl = createInterface();

  return new Promise((resolve) => {
    rl.question(`How many accounts would you like to generate? `, (answer) => {
      rl.close();
      const count = parseInt(answer, 10);
      if (isNaN(count) || count <= 0) {
        console.log("Invalid input. Please enter a positive number.");
        // Properly handle the Promise chain using void
        void askForAccountCount().then(resolve);
      } else {
        resolve(count);
      }
    });
  });
}

// Function to ask for environments
async function askForEnvironments(): Promise<XmtpEnv[]> {
  const rl = createInterface();

  return new Promise((resolve) => {
    rl.question(
      `Enter XMTP environments to use (comma-separated: local,dev,production): `,
      (answer) => {
        rl.close();
        const envs = answer.split(",").map((e) => e.trim().toLowerCase());
        const validEnvs = envs.filter((env) =>
          validEnvironments.includes(env as XmtpEnv),
        );

        if (validEnvs.length === 0) {
          console.log(
            "No valid environments provided. Using 'local' as default.",
          );
          resolve(["local"]);
        } else {
          resolve(validEnvs as XmtpEnv[]);
        }
      },
    );
  });
}

async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  // Get number of accounts
  let numAccounts: number;
  if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
    numAccounts = parseInt(args[0], 10);
  } else {
    numAccounts = await askForAccountCount();
  }

  // Get environments
  let environments: XmtpEnv[] = [];

  if (args.length > 1) {
    const inputEnvs = args[1].split(",").map((e) => e.trim().toLowerCase());
    environments = inputEnvs.filter((env) =>
      validEnvironments.includes(env as XmtpEnv),
    ) as XmtpEnv[];
  }

  // If no valid environments specified in args, ask for them
  if (environments.length === 0) {
    environments = await askForEnvironments();
  }

  console.log(`Using environments: ${environments.join(", ")}`);

  // Create a custom folder name based on count and environments
  const folderName = `db-generated-${numAccounts}-${environments.join(",")}`;
  const LOGPATH = `${BASE_LOGPATH}/${folderName}`;
  // Create db directory if it doesn't exist
  if (!fs.existsSync(`${LOGPATH}${DB_PATH}`)) {
    console.log(`Creating directory: ${LOGPATH}...`);
    fs.mkdirSync(`${LOGPATH}${DB_PATH}`, { recursive: true });
  }
  // Array to store account data
  const accountData = [];

  console.log(
    `Generating ${numAccounts} accounts with XMTP clients for environments: ${environments.join(", ")}...`,
  );

  // Create a timestamp for the output file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = `${LOGPATH}/generated-inboxes-${timestamp}.json`;

  for (let i = 0; i < numAccounts; i++) {
    // Generate a random private key
    const privateKey = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    try {
      const signer = createSigner(privateKey as `0x${string}`);
      const identifier = await signer.getIdentifier();
      const address = identifier.identifier;

      // Generate encryption key
      const encryptionKeyHex = generateEncryptionKeyHex();
      const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

      // Create XMTP clients for each environment
      const clientsInfo = [];

      for (const env of environments) {
        const client = await Client.create(signer, encryptionKey, {
          dbPath: `${LOGPATH}${DB_PATH}/${env}-${address}`,
          env: env,
        });

        // Get the inbox ID for this client
        clientsInfo.push({
          env,
          inboxId: client.inboxId,
        });

        console.log(
          `Created client in ${env} environment for account ${i + 1}/${numAccounts}: ${address}`,
        );
      }

      // Store the account information
      accountData.push({
        accountAddress: address,
        privateKey,
        encryptionKey: encryptionKeyHex,
        clients: clientsInfo,
      });

      // Write the data to a JSON file
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

main().catch(console.error);
