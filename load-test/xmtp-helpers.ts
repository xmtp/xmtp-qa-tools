import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import { getRandomValues } from "node:crypto";
import { fromString, toString } from "uint8arrays";

// Define IdentifierKind inline as it's not directly exported from node-sdk in all versions
export enum IdentifierKind {
  Ethereum = 0,
  Passkey = 1,
}

interface Signer {
  type: "EOA" | "SCW";
  getIdentifier: () => { identifierKind: IdentifierKind; identifier: string };
  signMessage: (message: string) => Promise<Uint8Array>;
  getAddress: () => Promise<string>;
  getChainId: () => Promise<bigint>;
}

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

/**
 * Creates a user object with a wallet and account
 * @param key - The private key
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
    getAddress: async () => user.account.address,
    getChainId: async () => BigInt(sepolia.id),
  };
};

/**
 * Generate a random encryption key
 * @returns Hex string of 64 characters
 */
export const generateEncryptionKey = () => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex");
};

/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key as Uint8Array
 */
export const encryptionKeyFromHex = (hex: string) => {
  return fromString(hex, "hex");
};
