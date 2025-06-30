import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
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
  loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  networks: ["dev"],
  ...DEFAULT_SKILL_OPTIONS,
};

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

    await client.conversations.sync();
    console.debug(`[${env}] Waiting for messages...`);
    void client.conversations.streamAllMessages((error, message) => {
      if (error) {
        console.error(`[${env}] Error in streamMessages:`, error);
        void sendSlackNotification(
          `[${env}] Error in streamMessages: ${error.message}`,
          `key-check`,
        );
        return;
      }
      if (message) {
        void processMessage(
          client,
          message,
          callBack,
          skillOpts,
          env || "unknown",
        ).catch((err: unknown) => {
          console.error(`[${env}] Error processing message:`, err);
        });
      }
    });
  };

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
  return clients;
};

export const sendSlackNotification = async (
  message: string,
  source: string,
  channel?: string,
) => {
  console.log("Sending slack notification", message, source);
  if (!process.env.SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN is not set");
  }

  const targetChannel = channel || process.env.SLACK_CHANNEL || "#general";

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: targetChannel,
      text: `[${source}] ${message}`,
      mrkdwn: true,
    }),
  });
};
