/**
 * XMTP Helper Functions
 * Copied from helpers/client.ts to keep load-test isolated
 */

import { createWalletClient, http, type PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { toBytes } from "viem/utils";
import { fromString, toString } from "uint8arrays";
import { getRandomValues } from "node:crypto";
import type { Signer } from "@xmtp/node-sdk";

// IdentifierKind enum from XMTP SDK
const IdentifierKind = {
  Ethereum: 0,
  Passkey: 1,
} as const;

interface User {
  key: `0x${string}`;
  account: PrivateKeyAccount;
  wallet: ReturnType<typeof createWalletClient>;
}

/**
 * Creates a user object with a wallet and account
 * @param key - Optional private key, generates one if not provided
 * @returns The user object
 */
export const createUser = (key?: `0x${string}`): User => {
  const privateKey = key || generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  return {
    key: privateKey,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

/**
 * Creates a signer object for XMTP client
 * @param key - The private key or User object
 * @returns The signer object
 */
export const createSigner = (key: string | User): Signer => {
  let user: User;
  
  if (typeof key === "string") {
    const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
    user = createUser(sanitizedKey as `0x${string}`);
  } else {
    user = key;
  }
  
  return {
    type: "EOA",
    getAddress: () => user.account.address.toLowerCase(),
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
 * @returns Hex string of 64 characters
 */
export const generateEncryptionKey = (): string => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

/**
 * Convert hex string to Uint8Array encryption key
 * @param hex - The hex string
 * @returns Uint8Array encryption key
 */
export const encryptionKeyFromHex = (hex: string): Uint8Array => {
  return fromString(hex, "hex");
};

