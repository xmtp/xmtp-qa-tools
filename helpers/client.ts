import fs from "fs";
import { getRandomValues } from "node:crypto";
import { type Signer } from "node-sdk-42";
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
export const dbPath = (name: string, installationName: string, env: string) => {
  const volumePath =
    process.env.RAILWAY_VOLUME_MOUNT_PATH ??
    `.data/${name.toLowerCase()}/${name.toLowerCase()}-${installationName}`;

  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  const dbPath = `${volumePath}/${name.toLowerCase()}-${installationName}-${env}`;
  return dbPath;
};
export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};
