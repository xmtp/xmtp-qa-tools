import {
  Client,
  type DecodedMessage,
  type LogLevel,
  type XmtpEnv,
} from "@workers/versions";
import "dotenv/config";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "@helpers/client";
import { generatePrivateKey } from "viem/accounts";
import {
  DEFAULT_SKILL_OPTIONS,
  processMessage,
  type MessageHandler,
  type SkillOptions,
} from "../helpers/xmtp-skills";

// Retry configuration constants
const MAX_RETRIES = 5;
// wait 5 seconds before each retry
const RETRY_INTERVAL = 5000;

/**
 * Core options for XMTP client initialization that includes skill options
 */
export interface ClientOptions extends SkillOptions {
  walletKey?: `0x${string}`;
  /** Encryption key for the client */
  dbEncryptionKey?: string;
  /** Networks to connect to (default: ['dev', 'production']) */
  networks?: string[];
  /** Logging level */
  loggingLevel?: LogLevel;
}

// Default options
export const DEFAULT_CORE_OPTIONS: ClientOptions = {
  walletKey: (process.env.WALLET_KEY ?? generatePrivateKey()) as `0x${string}`,
  dbEncryptionKey: process.env.ENCRYPTION_KEY ?? generateEncryptionKeyHex(),
  loggingLevel: (process.env.LOGGING_LEVEL || "error") as LogLevel,
  networks: ["dev"],
  ...DEFAULT_SKILL_OPTIONS,
};

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handle message streaming with retry logic using onMessage callback
 */
const handleStream = async (
  client: Client,
  callBack: MessageHandler,
  skillOpts: SkillOptions,
): Promise<void> => {
  let retries = MAX_RETRIES; // Per-stream retry counter
  const env = client.options?.env;

  const retry = async (): Promise<void> => {
    if (retries > 0) {
      retries--;
      console.log(
        `[${env}] Retrying in ${RETRY_INTERVAL / 1000}s, ${retries} retries left`,
      );
      await sleep(RETRY_INTERVAL);
      try {
        await handleStream(client, callBack, skillOpts);
      } catch (error: unknown) {
        console.error(`[${env}] Retry attempt failed:`, error);
        await retry();
      }
    } else {
      console.log(`[${env}] Max retries reached, ending process`);
      process.exit(1);
    }
  };

  const onFail = (): void => {
    console.log(`[${env}] Stream failed`);
    void (async () => {
      try {
        await retry();
      } catch (error: unknown) {
        console.error(`[${env}] Failed to retry after stream failure:`, error);
        process.exit(1);
      }
    })();
  };

  const onMessage = (err: Error | null, message?: DecodedMessage) => {
    if (err) {
      console.error(`[${env}] Stream error:`, err);
      return;
    }

    if (!message) {
      return;
    }

    // Reset retry counter on successful message processing
    retries = MAX_RETRIES;

    // Process message asynchronously without blocking the callback
    void (async () => {
      try {
        await processMessage(
          client,
          message,
          callBack,
          skillOpts,
          env || "unknown",
        );
      } catch (err: unknown) {
        console.error(`[${env}] Error processing message:`, err);
      }
    })();
  };

  try {
    console.log(`[${env}] Syncing conversations...`);
    await client.conversations.sync();

    console.log(`[${env}] Waiting for messages...`);
    await client.conversations.streamAllMessages(
      onMessage,
      undefined,
      undefined,
      onFail,
    );
  } catch (err: unknown) {
    console.error(`[${env}] Error streaming messages:`, err);
    try {
      await retry();
    } catch (error: unknown) {
      console.error(`[${env}] Failed to retry after streaming error:`, error);
      process.exit(1);
    }
  }
};

/**
 * Initialize XMTP clients with robust error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  coreOptions: ClientOptions[],
): Promise<Client[]> => {
  // Merge default options with the provided options
  const mergedCoreOptions = coreOptions.map((opt) => ({
    ...DEFAULT_CORE_OPTIONS,
    ...opt,
  }));

  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];

  for (const option of mergedCoreOptions) {
    for (const env of option.networks ?? []) {
      try {
        const signer = createSigner(option.walletKey as string);
        const dbEncryptionKey = getEncryptionKeyFromHex(
          option.dbEncryptionKey as string,
        );
        const signerIdentifier = (await signer.getIdentifier()).identifier;

        // Extract skill options from the client options
        const skillOptions: SkillOptions = {
          acceptGroups: option.acceptGroups,
          publicKey: option.publicKey,
          acceptTypes: option.acceptTypes,
          welcomeMessage: option.welcomeMessage,
          groupWelcomeMessage: option.groupWelcomeMessage,
          allowedCommands: option.allowedCommands,
          commandPrefix: option.commandPrefix,
          strictCommandFiltering: option.strictCommandFiltering,
          codecs: option.codecs,
        };

        const client = await Client.create(signer, {
          dbEncryptionKey,
          env: env as XmtpEnv,
          loggingLevel: option.loggingLevel,
          dbPath: getDbPath(`${env}-${signerIdentifier}`),
          codecs: skillOptions.codecs ?? [],
        });

        // @ts-expect-error - TODO: fix this
        clients.push(client);

        const streamPromise = handleStream(
          // @ts-expect-error - TODO: fix this
          client,
          messageHandler,
          skillOptions,
        );

        streamPromises.push(streamPromise);
      } catch (error) {
        console.error(`[${env}] Client initialization error:`, error);
      }
    }
  }

  await logAgentDetails(clients);
  return clients;
};
