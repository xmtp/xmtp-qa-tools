import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import { type Signer, type WorkerManager, type XmtpEnv } from "@helpers/types";
import {
  IdentifierKind,
  type Client,
  type LogLevel,
} from "@xmtp/node-bindings";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { flushMetrics, initDataDog } from "./datadog";
import { createLogger, flushLogger, overrideConsole } from "./logger";
import { sdkVersions } from "./tests";

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

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
): Promise<{
  client: Client;
  dbPath: string;
  version: string;
  address: `0x${string}`;
}> {
  const signer = createSigner(walletKey);
  const encryptionKey = getEncryptionKeyFromHex(encryptionKeyHex);

  const sdkVersion = Number(workerData.sdkVersion);

  // Use type assertion to access the static version property
  const libXmtpVersion =
    sdkVersions[sdkVersion as keyof typeof sdkVersions].version;

  const version = `${libXmtpVersion}-${workerData.sdkVersion}`;

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier as `0x${string}`;
  const loggingLevel = process.env.LOGGING_LEVEL as LogLevel;
  const dbPath = getDbPath(
    workerData.name,
    address,
    workerData.testName,
    workerData.folder,
    version,
    env,
  );

  // Use type assertion to handle the client creation
  let ClientClass = sdkVersions[sdkVersion as keyof typeof sdkVersions].Client;
  if (!ClientClass) {
    throw new Error(`Unsupported SDK version: ${workerData.sdkVersion}`);
  }
  const client = (await ClientClass.create(signer, {
    dbEncryptionKey: encryptionKey,
    dbPath,
    env,
    loggingLevel,
  })) as unknown as Client;
  return { client, dbPath, version, address };
}

export const createSigner = (key: `0x${string}`): Signer => {
  const accountKey = key;
  const account = privateKeyToAccount(accountKey);
  let user: User = {
    key: accountKey,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
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

function loadDataPath(
  name: string,
  installationId: string,
  testName: string,
): string {
  // Extract the base name without installation ID for folder structure
  const baseName = name.toLowerCase().split("-")[0];
  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();
  // Use baseName for the parent folder, not the full name
  let basePath = `${preBasePath}/.data/${baseName}/${installationId}`;

  if (testName.includes("bug")) {
    basePath = basePath.replace("/.data/", `/bugs/${testName}/.data/`);
  }
  return basePath;
}
export const getDbPath = (
  name: string,
  accountAddress: string,
  testName: string,
  installationId: string,
  libxmtpVersion: string,
  env: XmtpEnv,
): string => {
  console.time(`[${name}] - getDbPath`);

  let identifier = `${accountAddress}-${env}`;

  const basePath = loadDataPath(name, installationId, testName);

  if (!fs.existsSync(basePath)) {
    console.log(`[${name}] Creating directory: ${basePath}`);
    fs.mkdirSync(basePath, { recursive: true });
  }

  const fullPath = `${basePath}/${identifier}`;

  console.timeEnd(`[${name}] - getDbPath`);

  return fullPath;
};

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};

export function getDataPath(testName: string): string {
  let dataPath = path.join(".data");
  if (testName.includes("bug")) {
    dataPath = path.resolve(process.cwd(), "bugs/" + testName + "/.data");
  }
  return dataPath;
}
export function getEnvPath(testName: string): string {
  let envPath = path.join(".env");
  if (testName.includes("bug")) {
    envPath = path.resolve(process.cwd(), "bugs/" + testName + "/.env");
  }
  if (!fs.existsSync(envPath)) {
    // Create the directory structure for the env file
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    // Create the .env file if it doesn't exist
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `#XMTP\nLOGGING_LEVEL="off"\nXMTP_ENV="dev"\n`);
      console.log(`Created default .env file at ${envPath}`);
    }
  }
  console.log("Env path:", envPath);
  process.env.CURRENT_ENV_PATH = envPath;
  return envPath;
}
/**
 * Loads environment variables from the specified test's .env file
 */
export function loadEnv(testName: string) {
  dotenv.config({ path: getEnvPath(testName) });
  const logger = createLogger(testName);
  overrideConsole(logger);
  // Create the .env file path
  const env = process.env.XMTP_ENV as XmtpEnv;

  console.log("XMTP_ENV", process.env.XMTP_ENV);
  initDataDog(
    testName,
    process.env.XMTP_ENV ?? "",
    process.env.GEOLOCATION ?? "",
    process.env.DATADOG_API_KEY ?? "",
  );
}

export async function closeEnv(testName: string, workers: WorkerManager) {
  flushLogger(testName);

  await flushMetrics(testName);
  if (workers && typeof workers.getWorkers === "function") {
    for (const worker of workers.getWorkers()) {
      await worker.worker.terminate();
    }
  }
}

export async function listInstallations(workers: WorkerManager) {
  for (const worker of workers.getWorkers()) {
    const inboxState = await worker.client?.preferences.inboxState();
    if (inboxState) {
      console.log(
        worker.name,
        "has",
        inboxState.installations.length,
        "installations",
      );
      //for (const installation of inboxState.installations) {
      // console.debug(
      //   worker.name +
      //     "(" +
      //     String(inboxState.installations.length) +
      //     ")" +
      //     installation.id,
      // );
      //}
    }
  }
}
