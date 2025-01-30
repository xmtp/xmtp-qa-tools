import { getRandomValues } from "node:crypto";
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
