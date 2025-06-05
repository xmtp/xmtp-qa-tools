import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import "dotenv/config";
import { generatePrivateKey } from "viem/accounts";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "../helpers/client";
import {
  DEFAULT_SKILL_OPTIONS,
  processMessage,
  type MessageHandler,
  type SkillOptions,
} from "../helpers/xmtp-skills";

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
  walletKey: (process.env.WALLET_KEY as `0x${string}`) ?? generatePrivateKey(),
  dbEncryptionKey:
    (process.env.ENCRYPTION_KEY as string) ?? generateEncryptionKeyHex(),
  loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  networks: ["dev"],
  ...DEFAULT_SKILL_OPTIONS,
};

// Constants
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 2000;

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

  /**
   * Core message streaming function with robust error handling
   */
  const streamMessages = async (
    client: Client,
    callBack: MessageHandler,
    skillOpts: SkillOptions,
  ): Promise<void> => {
    const env = client.options?.env;
    let retryCount = 0;
    let backoffTime = RETRY_DELAY_MS;

    // Start stream with limited retries
    while (retryCount < MAX_RETRIES) {
      try {
        if (retryCount === 0) {
          backoffTime = RETRY_DELAY_MS;
        }
        await client.conversations.sync();
        console.debug(`[${env}] Waiting for messages...`);
        const streamPromise = client.conversations.streamAllMessages();
        const stream = await streamPromise;

        for await (const message of stream) {
          if (message) {
            console.debug("option", JSON.stringify(skillOpts, null, 2));
            await processMessage(
              client,
              message,
              callBack,
              skillOpts,
              env || "unknown",
            );
          }
        }

        // If we get here, stream ended normally - reset retry count
        retryCount = 0;
      } catch (error) {
        console.error(`[${env}] Stream error:`, error);
        retryCount++;

        // If error seems fatal (connection, auth issues), try to recreate client
        if (retryCount > MAX_RETRIES) {
          console.error(
            `[${env}] Max retries (${MAX_RETRIES}) reached for stream. Attempting recovery...`,
          );

          try {
            await initializeClient(messageHandler, coreOptions);
            retryCount = 0; // Reset retry counter after recovery
            continue;
          } catch (fatalError) {
            console.error(
              `[${env}] Recovery failed, will try again in 30 seconds:`,
              fatalError,
            );
            await sleep(30000); // Wait 30 seconds before trying again
            retryCount = 0; // Reset retry counter for fresh start
            continue;
          }
        }

        // Use exponential backoff with jitter
        backoffTime = Math.min(backoffTime * 1.5, 60000); // Cap at 1 minute
        const jitter = Math.random() * 0.3 * backoffTime; // 0-30% jitter
        const waitTime = backoffTime + jitter;

        console.debug(
          `[${env}] Retrying in ${Math.round(waitTime / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
        );
        await sleep(waitTime);
      }
    }
  };

  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];

  for (const option of mergedCoreOptions) {
    for (const env of option.networks ?? []) {
      try {
        const signer = createSigner(option.walletKey);
        const dbEncryptionKey = getEncryptionKeyFromHex(option.dbEncryptionKey);
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

        const streamPromise = streamMessages(
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

  //await Promise.all(streamPromises);
  return clients;
};
