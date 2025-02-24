import fs from "fs";
import { getRandomValues } from "node:crypto";
import { type Signer } from "@xmtp/node-sdk";
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
  installationId?: string,
  sdkVersion?: string,
  libxmtpVersion?: string,
): string => {
  console.time(`[${name}] - getDbPath`);
  const namePath = name.toLowerCase().includes("random")
    ? "random/" + name.toLowerCase()
    : name.toLowerCase();

  const nameSet = name.toLowerCase();
  const installationIdSet =
    installationId?.toLowerCase() ?? defaultValues.installationId;
  const sdkVersionSet = sdkVersion?.toLowerCase() ?? defaultValues.sdkVersion;
  const libxmtpVersionSet =
    libxmtpVersion?.toLowerCase() ?? defaultValues.libxmtpVersion;
  const identifier = `${nameSet}-${accountAddress}-${installationIdSet}-${sdkVersionSet}-${libxmtpVersionSet}-${env}`;
  const preBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? process.cwd();
  const basePath = `${preBasePath}/.data/${namePath}`;
  const result = `${basePath}/${identifier}`;
  console.time(`[${nameSet}] - create basePath`);
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
    console.warn("Creating directory", basePath);
  }
  console.timeEnd(`[${nameSet}] - create basePath`);
  console.timeEnd(`[${nameSet}] - getDbPath`);
  return result;
};

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};
