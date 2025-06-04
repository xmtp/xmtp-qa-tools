import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import {
  IdentifierKind,
  type Client,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { initDataDog } from "./datadog";
import { addFileLogging, setupPrettyLogs } from "./logger";
import { sdkVersions } from "./utils";

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
  const dbPath = getDbPath(
    workerData.name,
    address,
    workerData.testName,
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
): Promise<unknown> => {
  const loggingLevel = process.env.LOGGING_LEVEL as LogLevel;
  const versionStr = String(sdkVersion);
  const versionInt = parseInt(versionStr);
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
    });
    libXmtpVersionAfterClient = getLibXmtpVersion(ClientClass);
  } else if (versionInt >= 100 && versionInt < 200) {
    const signer = createSigner(walletKey);
    // @ts-expect-error: SDK version compatibility issues
    client = await ClientClass.create(signer, dbEncryptionKey, {
      dbPath,
      env,
      loggingLevel,
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

export const createSigner = (key: string): Signer => {
  const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
  const account = privateKeyToAccount(sanitizedKey as `0x${string}`);
  let user: User = {
    key: sanitizedKey as `0x${string}`,
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

function loadDataPath(name: string, installationId: string): string {
  // Extract the base name without installation ID for folder structure
  const baseName = name.toLowerCase().split("-")[0];
  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();
  // Use baseName for the parent folder, not the full name
  let basePath = `${preBasePath}/.data/${baseName}/${installationId}`;

  return basePath;
}
export const getDbPath = (
  name: string,
  accountAddress: string,
  testName: string,
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

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
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
  console.debug("envPath", envPath);
  return envPath;
}
/**
 * Loads environment variables from the specified test's .env file
 */
export function loadEnv(testName: string) {
  const envPath = getEnvPath();
  dotenv.config({ path: envPath });
  setupPrettyLogs();
  addFileLogging(testName);
  initDataDog();
}

export const logAgentDetails = async (
  clients: Client | Client[],
): Promise<void> => {
  const clientsByAddress = Array.isArray(clients)
    ? clients.reduce<Record<string, Client[]>>((acc, client) => {
        const address = client.accountIdentifier?.identifier ?? "";
        acc[address] = acc[address] ?? [];
        acc[address].push(client);
        return acc;
      }, {})
    : {
        [clients.accountIdentifier?.identifier ?? ""]: [clients],
      };

  for (const [address, clientGroup] of Object.entries(clientsByAddress)) {
    const firstClient = clientGroup[0];
    const inboxId = firstClient.inboxId;
    const environments = clientGroup
      .map((c) => c.options?.env ?? "dev")
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

    console.log(`
    ✓ XMTP Client:
    • Address: ${address}
    • Conversations: ${conversations.length}
    • InboxId: ${inboxId}
    • Networks: ${environments}
    ${urls.map((url) => `• URL: ${url}`).join("\n")}`);
  }
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
