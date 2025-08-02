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

const clients = new Map<XmtpEnv, Client>();

const initClient = async (network: XmtpEnv = "dev") => {
  if (clients.has(network)) {
    const existingClient = clients.get(network);
    if (existingClient) return existingClient;
  }

  const signer = createSigner(process.env.WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(
    process.env.ENCRYPTION_KEY as string,
  );

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: network,
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(`ping-api-${network}`),
  });

  clients.set(network, client);
  return client;
};

async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { address, network = "dev" } = body as {
      address: `0x${string}`;
      network?: XmtpEnv;
    };

    if (!address) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (network !== "dev" && network !== "production") {
      return new Response(
        JSON.stringify({ error: "Network must be 'dev' or 'production'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Pinging ${address} on ${network}...`);

    const client = await initClient(network);
    const startTime = Date.now();

    // Create or get conversation
    const conversation = await client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: address,
    });

    // Send ping message
    await conversation.send("ping");

    const responseTime = Date.now() - startTime;
    console.log(`Ping completed in ${responseTime}ms`);

    const response = {
      success: true,
      address,
      network,
      responseTime,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Ping error: ${errorMessage}`);

    const errorResponse = {
      error: "Failed to ping address",
      details: errorMessage,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Bun server configuration for Railway Functions
const server = Bun.serve({
  port: 3000,
  fetch: handler,
});

console.log(`🚀 XMTP Ping API server running on port ${server.port}`);

export { handler };
