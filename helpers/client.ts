import fs from "fs";
import { getRandomValues } from "node:crypto";
import { Client } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const createSigner = (privateKey: `0x${string}`) => {
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

export const generateEncryptionKeyHex = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

export const getEncryptionKeyFromHex = (hex: string) => {
  return fromString(hex, "hex");
};

export const getXmtpClient = async (name: string, env: string) => {
  if (!fs.existsSync(`.data/${name}`)) {
    fs.mkdirSync(`.data/${name}`, { recursive: true });
  }
  const dbPath = `.data/${name}/${name}-${env}`;
  const signer = createSigner(
    process.env[`WALLET_KEY_${name.toUpperCase()}`] as `0x${string}`,
  );
  const encryptionKey = getEncryptionKeyFromHex(
    process.env[`ENCRYPTION_KEY_${name.toUpperCase()}`] as string,
  );
  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env: "dev",
    dbPath,
  });
  return client;
};
