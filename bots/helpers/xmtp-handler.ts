import {
  type Client,
  type LogLevel,
  type XmtpEnv,
} from "version-management/client-versions";
import "dotenv/config";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "@helpers/client";
import { getActiveVersion } from "version-management/client-versions";
import { generatePrivateKey } from "viem/accounts";
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
  walletKey: (process.env.WALLET_KEY ?? generatePrivateKey()) as `0x${string}`,
  dbEncryptionKey: process.env.ENCRYPTION_KEY ?? generateEncryptionKeyHex(),
  loggingLevel: (process.env.LOGGING_LEVEL || "warn") as LogLevel,
  networks: [process.env.XMTP_ENV || "production"] as string[],
  ...DEFAULT_SKILL_OPTIONS,
};

/**
 * Handle message streaming with onMessage callback
 */
const handleStream = async (
  client: Client,
  callBack: MessageHandler,
  skillOpts: SkillOptions,
): Promise<void> => {
  const env = client.options?.env;

  try {
    console.log(`[${env}] Syncing conversations...`);
    await client.conversations.sync();

    console.log(`[${env}] Waiting for messages...`);
    const stream = await client.conversations.streamAllMessages();

    for await (const message of stream) {
      // Process message asynchronously
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
    }
  } catch (err: unknown) {
    console.error(`[${env}] Error streaming messages:`, err);
    throw err;
  }
};

/**
 * Initialize XMTP clients with error handling
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
    for (const env of option.networks) {
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

        // @ts-expect-error - TODO: fix this
        const client = await getActiveVersion().Client.create(signer, {
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
