import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import { type Signer } from "@helpers/types";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { flushMetrics, initDataDog } from "./datadog";
import {
  captureProcessOutput,
  createLogger,
  flushLogger,
  overrideConsole,
} from "./logger";
import { defaultValues, type Persona, type XmtpEnv } from "./types";
import { clearWorkerCache } from "./workers/factory";

interface User {
  key: string;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

const createUser = (key: string): User => {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

export const createSigner = (key: string): Signer => {
  const user = createUser(key);
  return {
    walletType: "EOA",
    getAddress: () => user.account.address,
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account,
      });
      return toBytes(signature);
    },
  };
};
function loadDataPath(name: string, testName: string): string {
  // Extract the base name without installation ID for folder structure
  const baseName = name.toLowerCase().split("-")[0];
  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();

  // Use baseName for the parent folder, not the full name
  let basePath = `${preBasePath}/.data/${baseName}`;

  //Load data for bugs
  if (testName.includes("bug")) {
    basePath = `${preBasePath}/bugs/${testName}/.data/${baseName}`;
  }
  return basePath;
}
export const getDbPath = (
  name: string,
  accountAddress: string,
  testName: string,
  instance?: {
    installationId?: string;
    sdkVersion?: string;
    libxmtpVersion?: string;
  },
): string => {
  console.time(`[${name}] - getDbPath`);

  // For the identifier, use either the name as-is (if it already has installation ID)
  // or construct it with the installation ID from instance
  let identifier;
  const env = process.env.XMTP_ENV as XmtpEnv;
  if (name.includes("-")) {
    // Name already has installation ID (e.g., "fabritest-a")
    identifier = `${name.toLowerCase()}-${accountAddress}-${instance?.sdkVersion ?? defaultValues.sdkVersion}-${instance?.libxmtpVersion ?? ""}-${env}`;
  } else {
    // Name doesn't have installation ID, use the one from instance
    const installationId =
      instance?.installationId?.toLowerCase() ?? defaultValues.installationId;
    identifier = `${name.toLowerCase()}-${installationId}-${accountAddress}-${instance?.sdkVersion ?? defaultValues.sdkVersion}-${instance?.libxmtpVersion ?? ""}-${env}`;
  }
  const basePath = loadDataPath(name, testName);

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    console.warn("Creating directory", basePath);
  }
  console.timeEnd(`[${name}] - getDbPath`);

  return `${basePath}/${identifier}`;
};

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};

function getEnvPath(testName: string): string {
  let envPath = path.join(".env");
  if (testName.includes("bug")) {
    envPath = path.resolve(process.cwd(), "bugs/" + testName + "/.env");
  }
  console.log("envPath", envPath);
  if (!fs.existsSync(envPath)) {
    // Create the directory structure for the env file
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    // Create the .env file if it doesn't exist
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `#XMTP\nLOGGING_LEVEL="off"\nXMTP_ENV="dev"\n`);
      console.log(`Created default .env file at ${envPath}`);
    }
  }
  process.env.CURRENT_ENV_PATH = envPath;
  return envPath;
}
/**
 * Loads environment variables from the specified test's .env file
 */
export function loadEnv(testName: string) {
  const logger = createLogger(testName);
  overrideConsole(logger);
  dotenv.config({ path: getEnvPath(testName) });
  // Create the .env file path
  const env = process.env.XMTP_ENV;
  if (env !== "dev" && env !== "production" && env !== "local") {
    throw new Error("XMTP_ENV is not set in .env file or its not valid");
  }
  initDataDog(
    testName,
    process.env.XMTP_ENV ?? "",
    process.env.GEOLOCATION ?? "",
    process.env.DATADOG_API_KEY ?? "",
  );
}
export async function closeEnv(
  testName: string,
  personas: Record<string, Persona>,
) {
  flushLogger(testName);

  await flushMetrics();

  for (const persona of Object.values(personas)) {
    await persona.worker?.terminate();
  }

  await clearWorkerCache();
}
