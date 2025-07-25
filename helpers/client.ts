import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import manualUsers from "@inboxes/manualusers.json";
import type { Worker, WorkerManager } from "@workers/manager";
import { regressionClient } from "@workers/versions";
import {
  Client,
  Dm,
  Group,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import {
  privateKeyToAccount,
  generatePrivateKey as viemGeneratePrivateKey,
} from "viem/accounts";
import { sepolia } from "viem/chains";
import { addFileLogging, setupPrettyLogs } from "./logger";

export {
  Dm,
  Group,
  Client,
  type Conversation,
  type DecodedMessage,
  type LogLevel,
  type XmtpEnv,
};

export function validateEnvironment(vars: string[]): Record<string, string> {
  const missing = vars.filter((v) => !process.env[v]);

  if (missing.length) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const envVars = fs
          .readFileSync(envPath, "utf-8")
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("#"))
          .reduce<Record<string, string>>((acc, line) => {
            const [key, ...val] = line.split("=");
            if (key && val.length) acc[key.trim()] = val.join("=").trim();
            return acc;
          }, {});

        missing.forEach((v) => {
          if (envVars[v]) process.env[v] = envVars[v];
        });
      }
    } catch (e) {
      console.error(e);
      /* ignore errors */
    }

    const stillMissing = vars.filter((v) => !process.env[v]);
    if (stillMissing.length) {
      console.error("Missing env vars:", stillMissing.join(", "));
      process.exit(1);
    }
  }

  return vars.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] as string;
    return acc;
  }, {});
}

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};
interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

/**
 * Creates a user object with a wallet and account
 * @param key - The private key
 * @returns The user object
 */
export const createUser = (key: string): User => {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key: key as `0x${string}`,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

/**
 * Creates a signer object with a wallet and account
 * @param key - The private key
 * @returns The signer object
 */
export const createSigner = (key: string): Signer => {
  const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
  const user = createUser(sanitizedKey);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: user.account.address.toLowerCase(),
    }),
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account,
      });
      return toBytes(signature);
    },
  };
};

export const generatePrivateKey = (): `0x${string}` => {
  return viemGeneratePrivateKey();
};
/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export const generateEncryptionKeyHex = () => {
  /* Generate a random encryption key */
  const uint8Array = getRandomValues(new Uint8Array(32));
  /* Convert the encryption key to a hex string */
  return toString(uint8Array, "hex");
};

/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key
 */
export const getEncryptionKeyFromHex = (hex: string) => {
  /* Convert the hex string to an encryption key */
  return fromString(hex, "hex");
};

export const logAgentDetails = async (
  clients: Client | Client[],
): Promise<void> => {
  const clientArray = Array.isArray(clients) ? clients : [clients];
  const clientsByAddress = clientArray.reduce<Record<string, Client[]>>(
    (acc, client) => {
      const address = client.accountIdentifier?.identifier as string;
      acc[address] = acc[address] ?? [];
      acc[address].push(client);
      return acc;
    },
    {},
  );

  for (const [address, clientGroup] of Object.entries(clientsByAddress)) {
    const firstClient = clientGroup[0];
    const inboxId = firstClient.inboxId;
    const installationId = firstClient.installationId;
    const environments = clientGroup
      .map((c: Client) => c.options?.env ?? "dev")
      .join(", ");
    console.log(`\x1b[38;2;252;76;52m
        ██╗  ██╗███╗   ███╗████████╗██████╗ 
        ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
         ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
         ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
        ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
        ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
      \x1b[0m`);

    const urls = [`http://xmtp.chat/dm/${address}`];

    const conversations = await firstClient.conversations.list();
    const inboxState = await firstClient.preferences.inboxState();
    const keyPackageStatuses =
      await firstClient.getKeyPackageStatusesForInstallationIds([
        installationId,
      ]);

    let createdDate = new Date();
    let expiryDate = new Date();

    // Extract key package status for the specific installation
    const keyPackageStatus = keyPackageStatuses[installationId];
    if (keyPackageStatus.lifetime) {
      createdDate = new Date(
        Number(keyPackageStatus.lifetime.notBefore) * 1000,
      );
      expiryDate = new Date(Number(keyPackageStatus.lifetime.notAfter) * 1000);
    }
    console.log(`
    ✓ XMTP Client:
    • InboxId: ${inboxId}
    • Bindings: ${Client.version}
    • Address: ${address}
    • Conversations: ${conversations.length}
    • Installations: ${inboxState.installations.length}
    • InstallationId: ${installationId}
    • Key Package created: ${createdDate.toLocaleString()}
    • Key Package valid until: ${expiryDate.toLocaleString()}
    • Networks: ${environments}
    ${urls.map((url) => `• URL: ${url}`).join("\n")}`);
  }
};
export const getDbPath = (description: string = "xmtp") => {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${description}.db3`;
};
export const getDbPathQA = (description: string = "xmtp") => {
  //Checks if the environment is a Railway deployment
  const volumePath = ".data/";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${description}.db3`;
};

export async function createClient(
  walletKey: `0x${string}`,
  encryptionKeyHex: string,
  sdk: string,
  name: string,
  folder: string,
  env: XmtpEnv,
  apiUrl?: string,
): Promise<{
  client: unknown;
  dbPath: string;
  address: `0x${string}`;
}> {
  const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

  const account = privateKeyToAccount(walletKey);
  const address = account.address;
  const dbPath = getDbPathOfInstallation(name, address, folder, env);

  // Use type assertion to handle the client creation
  const client = await regressionClient(
    sdk,
    walletKey,
    encryptionKey,
    dbPath,
    env,
    apiUrl,
  );

  return {
    client,
    dbPath,
    address,
  };
}

function loadDataPath(name: string, installationId: string): string {
  // Extract the base name without installation ID for folder structure
  const baseName = name.toLowerCase().split("-")[0];
  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();
  // Use baseName for the parent folder, not the full name
  let basePath = `${preBasePath}/.data/${baseName}/${installationId}`;

  return basePath;
}
export const getDbPathOfInstallation = (
  name: string,
  accountAddress: string,
  installationId: string,
  env: XmtpEnv,
): string => {
  let identifier = `${accountAddress}-${env}`;

  const basePath = loadDataPath(name, installationId);

  if (!fs.existsSync(basePath)) {
    console.debug(`[${name}] Creating directory: ${basePath}`);
    fs.mkdirSync(basePath, { recursive: true });
  }

  const fullPath = `${basePath}/${identifier}`;

  return fullPath;
};

export function getDataPath(): string {
  let dataPath = path.join(".data");
  return dataPath;
}
export function getEnvPath(): string {
  let envPath = path.join(".env");

  // Only set CURRENT_ENV_PATH if the file exists
  if (fs.existsSync(envPath)) {
    process.env.CURRENT_ENV_PATH = envPath;
  }
  return envPath;
}

/**
 * Loads environment variables from the specified test's .env file if it exists
 */
export function loadEnv(testName: string) {
  const envPath = getEnvPath();

  // Only load .env file if it exists, otherwise use defaults from process.env
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  setupPrettyLogs(testName);
  addFileLogging(testName);
}

// Add type definition for manual users
export type ManualUser = {
  name: string;
  app: string;
  [key: string]: string;
};

// Logging interface
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}

/**
 * Creates random installations for a worker
 */
export const createRandomInstallations = async (
  count: number,
  worker: Worker,
): Promise<Worker | undefined> => {
  console.debug(`[${worker.name}] Creating ${count} installations`);
  const initialState = await worker.client.preferences.inboxState(true);
  console.debug(
    `[${worker.name}] Initial inbox state: ${JSON.stringify(initialState)}`,
  );

  for (let i = 0; i < count; i++) {
    console.debug(`[${worker.name}] Creating installation ${i + 1}`);
    await worker.worker?.clearDB();
    await worker.worker?.initialize();
    await sleep(1000);
  }

  const finalState = await worker.client.preferences.inboxState(true);
  console.debug(
    `[${worker.name}] Created ${count} installations. Final state: ${JSON.stringify(finalState)}`,
  );
  return worker;
};

/**
 * Gets a random version from the versions array
 */
export const getRandomVersion = (versions: string[]): string =>
  versions[Math.floor(Math.random() * versions.length)];

/**
 * Randomly reinstalls a worker
 */
export const randomReinstall = async (
  workers: WorkerManager,
): Promise<void> => {
  const worker = workers.getRandomWorkers(1)[0];
  console.debug(`[${worker.name}] Reinstalling worker`);
  await worker.worker?.reinstall();
};

/**
 * Randomly removes database from workers
 */
export const randomlyRemoveDb = async (
  workers: WorkerManager,
): Promise<void> => {
  for (const worker of workers.getAll()) {
    if (Math.random() < 0.5) {
      console.warn(
        `${worker.name} terminates, deletes local data, and restarts`,
      );
      await worker.worker?.clearDB();
      await worker.worker?.initialize();
    }
  }
};

export const getManualUsers = (filterBy: string[] = []): ManualUser[] => {
  return (manualUsers as ManualUser[]).filter(
    (r) => filterBy.includes(r.name) || filterBy.includes(r.app),
  );
};

/**
 * Sleep utility function
 */
export const sleep = (ms: number = 1000): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Appends a variable to the .env file
 */
export const appendToEnv = (key: string, value: string): void => {
  try {
    const envPath = getEnvPath();
    console.debug(`[appendToEnv] Env path resolved to: ${envPath}`);
    console.debug(`[appendToEnv] File exists: ${fs.existsSync(envPath)}`);

    // Update process.env
    if (key in process.env) {
      process.env[key] = value;
    }

    // Read/create .env file
    let envContent = "";
    try {
      envContent = fs.readFileSync(envPath, "utf8");
      console.debug(
        `[appendToEnv] Read existing .env content (${envContent.length} chars)`,
      );
    } catch (error: unknown) {
      console.debug(
        `[appendToEnv] Creating new .env file, error reading: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Escape regex special chars
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    console.debug(`[appendToEnv] Escaped key: ${escapedKey}`);

    // Update or add the key
    if (envContent.includes(`${key}=`)) {
      console.debug(`[appendToEnv] Key ${key} already exists, updating`);
      envContent = envContent.replace(
        new RegExp(`${escapedKey}=.*(\\r?\\n|$)`, "g"),
        `${key}="${value}"$1`,
      );
    } else {
      console.debug(`[appendToEnv] Key ${key} does not exist, appending`);
      envContent += `\n${key}="${value}"\n`;
    }

    console.debug(`[appendToEnv] About to write to file: ${envPath}`);
    console.debug(
      `[appendToEnv] New content length: ${envContent.length} chars`,
    );

    fs.writeFileSync(envPath, envContent);
    console.debug(`[appendToEnv] Successfully wrote to file`);

    // Verify the write
    const verifyContent = fs.readFileSync(envPath, "utf8");
    const hasOurKey = verifyContent.includes(`${key}=`);
    console.debug(
      `[appendToEnv] Verification - file contains ${key}: ${hasOurKey}`,
    );

    console.debug(`Updated .env with ${key}: ${value}`);
  } catch (error) {
    console.error(`Failed to update .env with ${key}:`, error);
  }
};

export async function removeDataFolder(): Promise<void> {
  const dataPath = path.join(process.cwd(), ".data");
  if (fs.existsSync(dataPath)) {
    await fs.promises.rm(dataPath, { recursive: true, force: true });
  }
}

export const browserTimeout = 10000;
export const streamColdStartTimeout = 1000; // 1 second
export const streamTimeout = process.env.DEFAULT_STREAM_TIMEOUT_MS
  ? parseInt(process.env.DEFAULT_STREAM_TIMEOUT_MS)
  : 10000; // 10 seconds

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const logAndSend = async (
  message: string,
  conversation: Conversation,
  level: "info" | "warn" | "error" = "info",
): Promise<void> => {
  // Log to console based on level
  switch (level) {
    case "warn":
      console.warn(message);
      break;
    case "error":
      console.error(message);
      break;
    default:
      console.debug(message);
  }

  // Send to conversation if provided
  if (conversation && typeof conversation.send === "function") {
    await conversation.send(message);
  }
};
export const getMessageByMb = (mb: number) => {
  const message = "A".repeat(1024 * 1024 * mb);
  //const message = "A";
  console.log(`Message size: ${formatBytes(message.length)}`);
  return message;
};
