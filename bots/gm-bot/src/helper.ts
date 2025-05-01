import fs from "fs";
import { getRandomValues } from "node:crypto";
import { IdentifierKind, type Client, type Signer } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import "dotenv/config";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

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

export const getDbPath = (description: string = "xmtp") => {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${description}.db3`;
};

export const logAgentDetails = (client: Client) => {
  const address = client.accountIdentifier?.identifier ?? "";
  const inboxId = client.inboxId;
  const env = client.options?.env ?? "dev";
  const createLine = (length: number, char = "═"): string =>
    char.repeat(length - 2);
  const centerText = (text: string, width: number): string => {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    return " ".repeat(leftPadding) + text + " ".repeat(padding - leftPadding);
  };

  console.log(`\x1b[38;2;252;76;52m
    ██╗  ██╗███╗   ███╗████████╗██████╗ 
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
  \x1b[0m`);

  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  const maxLength = Math.max(url.length + 12, address.length + 15, 30);

  // Get the database path from client options or use the default path
  const dbPath =
    client.options?.dbPath ||
    `../${process.cwd().split("/").pop() || ""}/xmtp-${env}-${address}.db3`;
  const maxLengthWithDbPath = Math.max(maxLength, dbPath.length + 15);

  const box = [
    `╔${createLine(maxLengthWithDbPath)}╗`,
    `║   ${centerText("Agent Details", maxLengthWithDbPath - 6)} ║`,
    `╟${createLine(maxLengthWithDbPath, "─")}╢`,
    `║ 📍 Address: ${address}${" ".repeat(
      maxLengthWithDbPath - address.length - 15,
    )}║`,
    `║ 📍 inboxId: ${inboxId}${" ".repeat(
      maxLengthWithDbPath - inboxId.length - 15,
    )}║`,
    `║ 📂 DB Path: ${dbPath}${" ".repeat(
      maxLengthWithDbPath - dbPath.length - 15,
    )}║`,
    `║ 🛜  Network: ${env}${" ".repeat(maxLengthWithDbPath - env.length - 15)}║`,
    `║ 🔗 URL: ${url}${" ".repeat(maxLengthWithDbPath - url.length - 11)}║`,
    `╚${createLine(maxLengthWithDbPath)}╝`,
  ].join("\n");

  console.log(box);
};

export function validateEnvironment(vars: string[]): Record<string, string> {
  const requiredVars = vars;
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  return requiredVars.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] as string;
    return acc;
  }, {});
}
