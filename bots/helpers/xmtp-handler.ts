import {
  Client,
  Dm,
  Group,
  type Conversation,
  type DecodedMessage,
  type LogLevel,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "./client";
import "dotenv/config";
import {
  getCommandConfig,
  preMessageHandler,
  processMessageCommands,
} from "./xmtp-skills";

/**
 * Configuration options for the XMTP agent
 */
export interface AgentOptions {
  walletKey: string;
  /** Whether to accept group conversations */
  acceptGroups?: boolean;
  /** Encryption key for the client */
  dbEncryptionKey?: string;
  /** Networks to connect to (default: ['dev', 'production']) */
  networks?: string[];
  /** Logging level */
  loggingLevel?: LogLevel;
  /** Public key of the agent */
  publicKey?: string;
  /** Content types to accept (default: ['text']) */
  acceptTypes?: string[];
  /** Connection timeout in ms (default: 30000) */
  connectionTimeout?: number;
  /** Whether to auto-reconnect on fatal errors (default: true) */
  autoReconnect?: boolean;
  /** Welcome message to send to the conversation */
  welcomeMessage?: string;
  /** Whether to send a welcome message to the conversation */
  groupWelcomeMessage?: string;
  /** Codecs to use */
  codecs?: any[];
  /** Allowed commands that the agent will respond to */
  allowedCommands?: string[];
  /** Command prefix (default: "@toss") */
  commandPrefix?: string;
}

/**
 * Message context with analysis results
 */
export interface MessageContext {
  isDm: boolean;
  options: AgentOptions;
  isTransaction: boolean;
  command: string;
  hasCommand: boolean;
  commandData: { name: string; args: string[] };
}

/**
 * Message handler callback type
 */
type MessageHandler = (
  client: Client<any>,
  conversation: Conversation,
  message: DecodedMessage,
  messageContext: MessageContext,
) => Promise<void> | void;

// Constants
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 2000;
const DEFAULT_AGENT_OPTIONS: AgentOptions = {
  walletKey: "",
  dbEncryptionKey: process.env.ENCRYPTION_KEY ?? generateEncryptionKeyHex(),
  publicKey: "",
  loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  acceptGroups: false,
  acceptTypes: ["text"],
  networks: ["dev"],
  connectionTimeout: 30000,
  autoReconnect: true,
  welcomeMessage: "",
  codecs: [],
  allowedCommands: ["help"],
  commandPrefix: "@toss",
};

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Initialize XMTP clients with robust error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  options: AgentOptions[],
): Promise<Client[]> => {
  // Merge default options with the provided options
  const mergedOptions = options.map((opt) => ({
    ...DEFAULT_AGENT_OPTIONS,
    ...opt,
  }));

  /**
   * Core message streaming function with robust error handling
   */
  const streamMessages = async (
    client: Client<any>,
    callBack: MessageHandler,
    options: AgentOptions,
  ): Promise<void> => {
    const env = client.options?.env;
    let retryCount = 0;
    const acceptTypes = options.acceptTypes || ["text"];
    let backoffTime = RETRY_DELAY_MS;

    // Main stream loop - never exits
    while (true) {
      try {
        // Reset backoff time if we've been running successfully
        if (retryCount === 0) {
          backoffTime = RETRY_DELAY_MS;
        }
        await client.conversations.sync();
        console.debug(`[${env}] Waiting for messages...`);
        const streamPromise = client.conversations.streamAllMessages();
        const stream = await streamPromise;
        for await (const message of stream) {
          try {
            // Skip messages from self or with unsupported content types
            if (
              !message ||
              message.senderInboxId.toLowerCase() ===
                client.inboxId.toLowerCase() ||
              !acceptTypes.includes(message.contentType?.typeId ?? "text")
            ) {
              continue;
            }

            const conversation = await client.conversations.getConversationById(
              message.conversationId,
            );

            if (!conversation) {
              console.debug(`[${env}] Unable to find conversation, skipping`);
              continue;
            }

            console.debug(
              `[${env}] Received message: ${message.content as string} from ${message.senderInboxId}`,
            );

            const isDm = conversation instanceof Dm;
            const isGroup = conversation instanceof Group;

            const preMessageHandlerResult = await preMessageHandler(
              client,
              conversation as Conversation,
              message,
              isDm,
              options,
            );
            if (preMessageHandlerResult) {
              console.debug(
                `[${env}] Pre-message handler returned true, skipping`,
              );
              continue;
            }

            if (isDm || (isGroup && options.acceptGroups)) {
              try {
                console.debug(
                  `[${env}] Processing message ${message.content as string}...`,
                );

                // Get command configuration and analyze message
                const commandConfig = getCommandConfig(options);
                const analysis = processMessageCommands(
                  message,
                  commandConfig.prefix,
                );

                const messageContext: MessageContext = {
                  isDm,
                  options,
                  isTransaction: analysis.isTransaction,
                  command: analysis.command || "",
                  hasCommand: analysis.hasCommand,
                  commandData: analysis.commandData || { name: "", args: [] },
                };

                await messageHandler(
                  client,
                  conversation as Conversation,
                  message,
                  messageContext,
                );
              } catch (handlerError) {
                console.error(
                  `[${env}] Error in message handler:`,
                  handlerError,
                );
              }
            } else {
              console.debug(
                `[${env}] Conversation is not a DM and acceptGroups=false, skipping`,
              );
            }
          } catch (error) {
            // Handle errors within message processing without breaking the stream
            console.error(`[${env}] Error processing message:`, error);
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
            await initializeClient(messageHandler, [{ ...options }]);
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

  const clients: Client<any>[] = [];
  const streamPromises: Promise<void>[] = [];

  for (const option of mergedOptions) {
    for (const env of option.networks ?? []) {
      try {
        const signer = createSigner(option.walletKey);
        const dbEncryptionKey = getEncryptionKeyFromHex(
          option.dbEncryptionKey as string,
        );
        const signerIdentifier = (await signer.getIdentifier()).identifier;

        const client = await Client.create(signer, {
          dbEncryptionKey,
          env: env as XmtpEnv,
          loggingLevel: option.loggingLevel,
          dbPath: getDbPath(`${env}-${signerIdentifier}`),
          codecs: option.codecs ?? [],
        });

        clients.push(client);

        // Start message streaming
        const streamPromise = streamMessages(client, messageHandler, {
          ...option,
        });

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
