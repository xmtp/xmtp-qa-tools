import { getRandomValues } from "node:crypto";
import { type Client as ClientMls } from "@xmtp/node-sdk-mls";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes, type WalletClient } from "viem";
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import { sepolia } from "viem/chains";

// Define explicit interface for the return type
export interface User {
  key: `0x${string}`;
  account: PrivateKeyAccount;
  wallet: WalletClient;
}

export const createUser = (): User => {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
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

export const getSignature = async (client: ClientMls, user: User) => {
  if (client.signatureText) {
    const signature = await user.wallet.signMessage({
      message: client.signatureText,
      account: user.account,
    });
    return toBytes(signature);
  }
  return null;
};

/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export const generateEncryptionKeyHex = (): string => {
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
export const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
  /* Convert the hex string to an encryption key */
  return fromString(hex, "hex");
};
