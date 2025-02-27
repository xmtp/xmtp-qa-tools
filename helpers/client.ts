import fs from "fs";
import { getRandomValues } from "node:crypto";
import path from "node:path";
import { type Signer } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { fromString, toString } from "uint8arrays";
import { toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defaultValues } from "./types";

export const createSigner = (privateKey: `0x${string}`): Signer => {
  const account = privateKeyToAccount(privateKey);
  return {
    getAddress: () => account.address,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({
        message,
      });
      return toBytes(signature);
    },
  } as Signer;
};
export const getDbPath = (
  name: string,
  accountAddress: string,
  env: string,
  instance?: {
    installationId?: string;
    sdkVersion?: string;
    libxmtpVersion?: string;
  },
  tests?: {
    testName: string;
  },
): string => {
  console.time(`[${name}] - getDbPath`);

  // Extract the base name without installation ID for folder structure
  const baseName = name.toLowerCase().split("-")[0];

  // For the identifier, use either the name as-is (if it already has installation ID)
  // or construct it with the installation ID from instance
  let identifier;
  if (name.includes("-")) {
    // Name already has installation ID (e.g., "fabritest-a")
    identifier = `${name.toLowerCase()}-${accountAddress}-${instance?.sdkVersion ?? defaultValues.sdkVersion}-${instance?.libxmtpVersion ?? ""}-${env}`;
  } else {
    // Name doesn't have installation ID, use the one from instance
    const installationId =
      instance?.installationId?.toLowerCase() ?? defaultValues.installationId;
    identifier = `${name.toLowerCase()}-${installationId}-${accountAddress}-${instance?.sdkVersion ?? defaultValues.sdkVersion}-${instance?.libxmtpVersion ?? ""}-${env}`;
  }

  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();

  // Use baseName for the parent folder, not the full name
  let basePath = `${preBasePath}/.data/${baseName}`;

  if (tests && tests.testName && tests.testName.includes("bug")) {
    basePath = `${preBasePath}/bugs/${tests.testName}/.data/${baseName}`;
  }

  console.time(`[${name}] - create basePath`);
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    console.warn("Creating directory", basePath);
  }
  console.timeEnd(`[${name}] - create basePath`);
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

/**
 * Loads environment variables from the specified test's .env file
 */
export function loadEnv(testName: string): {
  path: string;
  parsed: dotenv.DotenvParseOutput | undefined;
} {
  // Ensure we're pointing to the bugs directory
  const bugsDir = path.resolve(process.cwd(), "bugs");

  // Create the specific test directory path
  const testDir = path.join(bugsDir, testName);

  // Create the .env file path
  const envPath = path.join(".env");

  if (testName.includes("bug")) {
    // Ensure the directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // If the .env file doesn't exist, create an empty one
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, "# Environment variables for test\n");
    }
  }

  // Load the environment variables
  const result = dotenv.config({ path: envPath });

  // Store the path in process.env so it can be accessed globally
  if (testName.includes("bug")) {
    process.env.CURRENT_ENV_PATH = envPath;
  }
  return {
    path: envPath,
    parsed: result.parsed,
  };
}
