import "dotenv/config";
import fs from "node:fs";
import {
  Client,
  IdentifierKind,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { fromString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const createUser = (key: string) => {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key: key as `0x${string}`,
    account,
    wallet: createWalletClient({ account, chain: sepolia, transport: http() }),
  };
};

const createSigner = (key: string): Signer => {
  const user = createUser(key.startsWith("0x") ? key : `0x${key}`);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: user.account.address.toLowerCase(),
    }),
    signMessage: async (message: string) =>
      toBytes(
        await user.wallet.signMessage({ message, account: user.account }),
      ),
  };
};

const getEncryptionKeyFromHex = (hex: string) => fromString(hex, "hex");

const getDbPath = (description = "xmtp") => {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  if (!fs.existsSync(volumePath)) fs.mkdirSync(volumePath, { recursive: true });
  return `${volumePath}/${description}.db3`;
};

let client: Client | null = null;

const initClient = async () => {
  if (client) return client;

  const signer = createSigner(process.env.WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(
    process.env.ENCRYPTION_KEY as string,
  );
  const env: XmtpEnv = (process.env.XMTP_ENV as XmtpEnv) || "dev";

  client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath("ping-api-" + env),
  });

  return client;
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { address } = (await req.json()) as { address: `0x${string}` };

    if (!address) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = await initClient();
    const startTime = Date.now();

    // Create or get conversation
    const conversation = await client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: address,
    });

    // Send ping message
    await conversation.send("ping");

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        address,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Ping error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to ping address",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
