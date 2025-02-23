import fs from "fs";
import { getRandomValues } from "node:crypto";
import { type Signer } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
  };
};
export const getDbPath = (
  name: string,
  installationId: string,
  version: string,
  env: string,
): string => {
  console.time(`[${name}] - getDbPath`);
  const folder = name.includes("random") ? "random" : name.toLowerCase();
  const basePath =
    process.env.RAILWAY_VOLUME_MOUNT_PATH ??
    `${process.cwd()}/.data/${folder}/${name.toLowerCase()}-${installationId}-${version}`;
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  const result = `${basePath}/${name.toLowerCase()}-${installationId}-${version}-${env}`;
  console.timeEnd(`[${name}] - getDbPath`);
  return result;
};

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};
