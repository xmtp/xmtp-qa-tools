import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import manualUsers from "@inboxes/manualusers.json";
import type { Worker, WorkerManager } from "@workers/manager";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
  IdentifierKind,
  type Client,
  type Conversation,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import {
  Client as Client47,
  Conversation as Conversation47,
  Dm as Dm47,
  Group as Group47,
} from "@xmtp/node-sdk-47";
import {
  Client as Client100,
  Conversation as Conversation100,
  Dm as Dm100,
  Group as Group100,
} from "@xmtp/node-sdk-100";
import {
  Client as Client105,
  Conversation as Conversation105,
  Dm as Dm105,
  Group as Group105,
} from "@xmtp/node-sdk-105";
import {
  Client as Client209,
  Conversation as Conversation209,
  Dm as Dm209,
  Group as Group209,
} from "@xmtp/node-sdk-209";
import {
  Client as Client210,
  Conversation as Conversation210,
  Dm as Dm210,
  Group as Group210,
} from "@xmtp/node-sdk-210";
import {
  Client as Client220,
  Conversation as Conversation220,
  Dm as Dm220,
  Group as Group220,
} from "@xmtp/node-sdk-220";
import {
  Client as ClientMls,
  Conversation as ConversationMls,
} from "@xmtp/node-sdk-mls";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import {
  privateKeyToAccount,
  generatePrivateKey as viemGeneratePrivateKey,
} from "viem/accounts";
import { sepolia } from "viem/chains";
import { initDataDog } from "./datadog";
import { addFileLogging, setupPrettyLogs } from "./logger";

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
    const installations = await firstClient.preferences.inboxState();

    console.log(`
    ✓ XMTP Client:
    • InboxId: ${inboxId}
    • Address: ${address}
    • Conversations: ${conversations.length}
    • Installations: ${installations.installations.length}
    • InstallationId: ${installationId}
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

export async function createClient(
  walletKey: `0x${string}`,
  encryptionKeyHex: string,
  workerData: {
    sdkVersion: string;
    name: string;
    testName: string;
    folder: string;
  },
  env: XmtpEnv,
  apiUrl?: string
): Promise<{
  client: unknown;
  dbPath: string;
  sdkVersion: string;
  libXmtpVersion: string;
  address: `0x${string}`;
}> {
  const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

  const sdkVersion = Number(workerData.sdkVersion);
  // Use type assertion to access the static version property
  const libXmtpVersion =
    sdkVersions[sdkVersion as keyof typeof sdkVersions].libXmtpVersion;

  const account = privateKeyToAccount(walletKey);
  const address = account.address;
  const dbPath = getDbPathOfInstallation(
    workerData.name,
    address,
    workerData.folder,
    env,
  );

  // Use type assertion to handle the client creation
  const client = await regressionClient(
    sdkVersion,
    libXmtpVersion,
    walletKey,
    encryptionKey,
    dbPath,
    env,
    apiUrl
  );

  return {
    client,
    dbPath,
    address,
    sdkVersion: String(sdkVersion),
    libXmtpVersion,
  };
}
export const regressionClient = async (
  sdkVersion: string | number,
  libXmtpVersion: string,
  walletKey: `0x${string}`,
  dbEncryptionKey: Uint8Array,
  dbPath: string,
  env: XmtpEnv,
  apiURL?: string
): Promise<unknown> => {
  const loggingLevel = process.env.LOGGING_LEVEL as LogLevel;
  const versionStr = String(sdkVersion);
  const versionInt = parseInt(versionStr);
  const apiUrl = apiURL;
  console.log(
    `Creating API client with: SDK version: ${String(sdkVersion)} walletKey: ${String(walletKey)} API URL: ${String(apiUrl)}`
  );

  const ClientClass =
    sdkVersions[versionInt as keyof typeof sdkVersions].Client;
  let client = null;
  let libXmtpVersionAfterClient = "unknown";
  if (versionInt === 30) {
    throw new Error("Invalid version");
  } else if (versionInt === 47) {
    const signer = createSigner47(walletKey);
    // @ts-expect-error: SDK version compatibility issues
    client = await ClientClass.create(signer, dbEncryptionKey, {
      dbPath,
      env,
      loggingLevel,
      apiUrl
    });
    libXmtpVersionAfterClient = getLibXmtpVersion(ClientClass);
  } else if (versionInt >= 100 && versionInt < 200) {
    const signer = createSigner(walletKey);
    // @ts-expect-error: SDK version compatibility issues
    client = await ClientClass.create(signer, dbEncryptionKey, {
      dbPath,
      env,
      loggingLevel,
      apiUrl
    });
    libXmtpVersionAfterClient = getLibXmtpVersion(ClientClass);
  } else if (versionInt >= 200) {
    const signer = createSigner(walletKey);
    // @ts-expect-error: SDK version compatibility issues
    client = await ClientClass.create(signer, {
      dbEncryptionKey,
      dbPath,
      env,
      loggingLevel,
      apiUrl,
      codecs: [new ReactionCodec(), new ReplyCodec()],
    });
    libXmtpVersionAfterClient = getLibXmtpVersion(ClientClass);
  } else {
    console.debug("Invalid version" + versionStr);
    throw new Error("Invalid version" + versionStr);
  }

  if (libXmtpVersion !== libXmtpVersionAfterClient) {
    console.debug(
      `libXmtpVersion mismatch: ${libXmtpVersionAfterClient} !== ${libXmtpVersion}`,
    );
  }

  if (!client) {
    throw new Error(`Failed to create client for SDK version ${versionStr}`);
  }

  return client;
};

// @ts-expect-error: SDK version compatibility issues
export const getLibXmtpVersion = (client: typeof ClientClass) => {
  try {
    const version = client.version;
    if (!version || typeof version !== "string") return "unknown";

    const parts = version.split("@");
    if (parts.length <= 1) return "unknown";

    const spaceParts = parts[1].split(" ");
    return spaceParts[0] || "unknown";
  } catch {
    return "unknown";
  }
};
export const createSigner47 = (privateKey: `0x${string}`) => {
  const account = privateKeyToAccount(privateKey);
  return {
    getAddress: () => account.address,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({
        message,
      });
      return toBytes(signature);
    },
  };
};

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

  if (!fs.existsSync(envPath)) {
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `#XMTP\nLOGGING_LEVEL="off"\nXMTP_ENV="dev"\n`);
      console.debug(`Created default .env file at ${envPath}`);
    }
  }
  process.env.CURRENT_ENV_PATH = envPath;
  return envPath;
}
/**
 * Loads environment variables from the specified test's .env file
 */
export function loadEnv(testName: string) {
  const envPath = getEnvPath();
  dotenv.config({ path: envPath });
  setupPrettyLogs(testName);
  addFileLogging(testName);
  initDataDog();
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
export const sdkVersionOptions = ["208", "209", "210", "220"];

// SDK version mappings
export const sdkVersions = {
  30: {
    Client: ClientMls,
    Conversation: ConversationMls,
    Dm: ConversationMls,
    Group: ConversationMls,
    sdkPackage: "node-sdk-mls",
    bindingsPackage: "node-bindings-mls",
    sdkVersion: "0.0.13",
    libXmtpVersion: "0.0.9",
  },
  47: {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
    sdkPackage: "node-sdk-47",
    bindingsPackage: "node-bindings-41",
    sdkVersion: "0.0.47",
    libXmtpVersion: "6bd613d",
  },
  100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
    sdkPackage: "node-sdk-100",
    bindingsPackage: "node-bindings-100",
    sdkVersion: "1.0.0",
    libXmtpVersion: "c205eec",
  },
  105: {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
    sdkPackage: "node-sdk-105",
    bindingsPackage: "node-bindings-113",
    sdkVersion: "1.0.5",
    libXmtpVersion: "6eb1ce4",
  },
  209: {
    Client: Client209,
    Conversation: Conversation209,
    Dm: Dm209,
    Group: Group209,
    sdkPackage: "node-sdk-209",
    bindingsPackage: "node-bindings-118",
    sdkVersion: "2.0.9",
    libXmtpVersion: "bfadb76",
  },
  210: {
    Client: Client210,
    Conversation: Conversation210,
    Dm: Dm210,
    Group: Group210,
    sdkPackage: "node-sdk-210",
    bindingsPackage: "node-bindings-120",
    sdkVersion: "2.1.0",
    libXmtpVersion: "7b9b4d0",
  },
  220: {
    Client: Client220,
    Conversation: Conversation220,
    Dm: Dm220,
    Group: Group220,
    sdkPackage: "node-sdk-220",
    bindingsPackage: "node-bindings-122",
    sdkVersion: "2.2.0",
    libXmtpVersion: "d0f0b67",
  },
};

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

export const getFixedNames = (count: number): string[] => {
  return [...defaultNames].slice(0, count);
};
export async function removeDataFolder(): Promise<void> {
  const dataPath = path.join(process.cwd(), ".data");
  if (fs.existsSync(dataPath)) {
    await fs.promises.rm(dataPath, { recursive: true, force: true });
  }
}
export function getMultiVersion(count: number): string[] {
  const descriptors: string[] = [];
  for (const descriptor of getFixedNames(count)) {
    const randomSdkVersion =
      sdkVersionOptions[Math.floor(Math.random() * sdkVersionOptions.length)];
    descriptors.push(`${descriptor}-a-${randomSdkVersion}`);
  }

  return descriptors;
}

/**
 * Creates worker descriptors with versions from TEST_VERSIONS environment variable
 * If TEST_VERSIONS is not set, uses the latest version
 * @param workerNames - Array of worker names to create descriptors for
 * @returns Array of worker descriptors with version suffixes
 */
export function getWorkersWithVersions(workerNames: string[]): string[] {
  const testVersions = parseInt(process.env.TEST_VERSIONS ?? "1");

  if (!testVersions) {
    // No versions specified, return names as-is (will use latest version)
    return workerNames;
  }

  const availableVersions = sdkVersionOptions.reverse().slice(0, testVersions);

  const descriptors: string[] = [];
  for (const workerName of workerNames) {
    // Pick a random version from the specified list
    const randomVersion =
      availableVersions[Math.floor(Math.random() * availableVersions.length)];
    descriptors.push(`${workerName}-a-${randomVersion}`);
  }

  return descriptors;
}

export const getRandomNames = (count: number): string[] => {
  return [...defaultNames].sort(() => Math.random() - 0.5).slice(0, count);
};
// Default worker names
export const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "walt",
  "uma",
  "vince",
  "xena",
  "yara",
  "zara",
  "guada", // max 61
];

export const browserTimeout = 10000;
export const playwrightBeforeSendTimeout = 1000; // 1 second
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
