import { getRandomValues } from "node:crypto";
import {
  Client,
  Dm,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type LogLevel,
  type Signer,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

/**
 * Configuration options for the XMTP agent
 */
interface AgentOptions {
  /** Whether to accept group conversations */
  acceptGroups: boolean;
  /** Networks to connect to (default: ['dev', 'production']) */
  networks?: string[];
  /** Content types to accept (default: ['text']) */
  acceptTypes?: string[];
  /** Connection timeout in ms (default: 30000) */
  connectionTimeout?: number;
  /** Whether to auto-reconnect on fatal errors (default: true) */
  autoReconnect?: boolean;
}

/**
 * Message handler callback type
 */
type MessageHandler = (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
) => Promise<void> | void;

// Constants
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 2000;
const WATCHDOG_RESTART_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_AGENT_OPTIONS: AgentOptions = {
  acceptGroups: false,
  acceptTypes: ["text"],
  networks: ["dev", "production"],
  connectionTimeout: 30000,
  autoReconnect: true,
};

/**
 * Generate a new encryption key (utility function)
 */
export const generateEncryptionKeyHex = (): string => {
  const uint8Array = getRandomValues(new Uint8Array(32));
  return toString(uint8Array, "hex") as string;
};

/**
 * Initialize XMTP clients with robust error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  options: AgentOptions = DEFAULT_AGENT_OPTIONS,
): Promise<Client[]> => {
  // Helper functions
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const validateEnvironment = (vars: string[]): Record<string, string> => {
    const requiredVars = vars;
    const missing = requiredVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      console.log(
        `Missing env vars: ${missing.join(", ")}. Trying root .env file...`,
      );

      const currentDir = process.cwd();
      const rootDir = path.resolve(currentDir, "../..");
      const rootEnvPath = path.join(rootDir, ".env");

      if (fs.existsSync(rootEnvPath)) {
        const envContent = fs.readFileSync(rootEnvPath, "utf-8");
        const envVars = envContent
          .split("\n")
          .filter((line) => line.trim() && !line.startsWith("#"))
          .reduce<Record<string, string>>((acc, line) => {
            const [key, ...valueParts] = line.split("=");
            if (key && valueParts.length) {
              acc[key.trim()] = valueParts.join("=").trim();
            }
            return acc;
          }, {});

        for (const varName of missing) {
          if (envVars[varName]) {
            process.env[varName] = envVars[varName];
            console.log(`Loaded ${varName} from root .env file`);
          }
        }
      } else {
        console.log("Root .env file not found.");
      }
    }

    const stillMissing = requiredVars.filter((v) => !process.env[v]);
    if (stillMissing.length > 0) {
      console.error(
        "Missing env vars after checking root .env:",
        stillMissing.join(", "),
      );
      process.exit(1);
    }

    return requiredVars.reduce<Record<string, string>>((acc, key) => {
      acc[key] = process.env[key] as string;
      return acc;
    }, {});
  };

  const createSigner = (key: string): Signer => {
    const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
    const account = privateKeyToAccount(sanitizedKey as `0x${string}`);

    return {
      type: "EOA",
      getIdentifier: () => ({
        identifierKind: IdentifierKind.Ethereum,
        identifier: account.address.toLowerCase(),
      }),
      signMessage: async (message: string) => {
        const signature = await createWalletClient({
          account,
          chain: sepolia,
          transport: http(),
        }).signMessage({
          message,
          account,
        });
        return toBytes(signature);
      },
    };
  };

  const getEncryptionKeyFromHex = (hex: string): Uint8Array => {
    return fromString(hex, "hex") as Uint8Array;
  };

  const getDbPath = (description: string = "xmtp"): string => {
    const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
    if (!fs.existsSync(volumePath)) {
      fs.mkdirSync(volumePath, { recursive: true });
    }
    return `${volumePath}/${description}.db3`;
  };

  const logAgentDetails = (clients: Client[]): void => {
    for (const client of clients) {
      const address = client.accountIdentifier?.identifier ?? "";
      const inboxId = client.inboxId;
      const env = client.options?.env ?? "dev";
      console.log(`
✓ XMTP Client Ready:
  • Address: ${address}
  • InboxId: ${inboxId}
  • Network: ${env}
  • URL: http://xmtp.chat/dm/${address}?env=${env}
      `);
    }
  };

  /**
   * Core message streaming function with robust error handling
   */
  const streamMessages = async (
    client: Client,
    callBack: MessageHandler,
    options: AgentOptions = DEFAULT_AGENT_OPTIONS,
    onActivity?: () => void,
  ): Promise<void> => {
    const env = client.options?.env ?? "undefined";
    let retryCount = 0;
    const acceptTypes = options.acceptTypes || ["text"];
    let backoffTime = RETRY_DELAY_MS;
    const autoReconnect = options.autoReconnect !== false;

    // Function to handle fatal errors by recreating the client
    const handleFatalError = async () => {
      if (!autoReconnect) {
        throw new Error(
          `[${env}] Fatal error in message stream and autoReconnect is disabled`,
        );
      }

      console.error(
        `[${env}] Fatal error detected, attempting to recreate client...`,
      );

      try {
        // Wait before attempting reconnection
        await sleep(5000);

        // Reload the client
        const signer = createSigner(WALLET_KEY);
        const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
        const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
        const signerIdentifier = (await signer.getIdentifier()).identifier;

        // Create a new client instance
        const newClient = await Client.create(signer, {
          dbEncryptionKey,
          env: env as XmtpEnv,
          loggingLevel,
          dbPath: getDbPath(`${env}-${signerIdentifier}`),
        });

        console.log(`[${env}] ✓ Client recreated successfully`);
        console.log(`[${env}] ✓ Syncing conversations...`);

        await newClient.conversations.sync();
        console.log(`[${env}] ✓ Conversations synced`);

        // Replace the old client with the new one
        Object.assign(client, newClient);

        console.log(`[${env}] ✓ Client reconnected successfully`);

        // Reset retry count
        retryCount = 0;
      } catch (error) {
        console.error(`[${env}] Failed to recreate client:`, error);
        throw error;
      }
    };

    // Main stream loop - never exits
    while (true) {
      try {
        // Reset backoff time if we've been running successfully
        if (retryCount === 0) {
          backoffTime = RETRY_DELAY_MS;
        }

        console.log(
          `[${env}] Starting message stream... ${retryCount > 0 ? `(attempt ${retryCount + 1}/${MAX_RETRIES})` : ""}`,
        );

        // Notify activity monitor
        if (onActivity) onActivity();

        const streamPromise = client.conversations.streamAllMessages();
        const stream = await streamPromise;

        console.log(`[${env}] Waiting for messages...`);

        for await (const message of stream) {
          try {
            // Notify activity monitor on each message
            if (onActivity) onActivity();

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
              console.log(`[${env}] Unable to find conversation, skipping`);
              continue;
            }

            console.log(
              `[${env}] Received message: ${message.content as string} from ${message.senderInboxId}`,
            );

            const isDm = conversation instanceof Dm;

            if (isDm || options.acceptGroups) {
              try {
                // Call the message handler and handle the returned value
                const result = messageHandler(
                  client,
                  conversation,
                  message,
                  isDm,
                );
                // Check if result is a Promise before calling catch
                if (result && typeof result.catch === "function") {
                  result.catch((error: unknown) => {
                    const errorMessage =
                      error instanceof Error ? error.message : String(error);
                    console.error(
                      `[${env}] Message handler error:`,
                      errorMessage,
                    );
                  });
                }
              } catch (handlerError) {
                console.error(
                  `[${env}] Error in message handler:`,
                  handlerError,
                );
              }
            } else {
              console.log(
                `[${env}] Conversation is not a DM and acceptGroups=false, skipping`,
              );
            }

            // Notify activity monitor after processing
            if (onActivity) onActivity();
          } catch (error) {
            // Handle errors within message processing without breaking the stream
            console.error(`[${env}] Error processing message:`, error);

            // Still notify activity monitor even on errors
            if (onActivity) onActivity();
          }
        }

        // If we get here, stream ended normally - reset retry count
        retryCount = 0;
      } catch (error) {
        console.error(`[${env}] Stream error:`, error);
        retryCount++;

        // Notify activity monitor
        if (onActivity) onActivity();

        // If error seems fatal (connection, auth issues), try to recreate client
        if (retryCount > MAX_RETRIES) {
          console.error(
            `[${env}] Max retries (${MAX_RETRIES}) reached for stream. Attempting recovery...`,
          );

          try {
            await handleFatalError();
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

        // Try to re-sync conversations before retrying
        try {
          console.log(`[${env}] Attempting to re-sync conversations...`);
          await client.conversations.sync();
          console.log(`[${env}] Conversations re-synced successfully`);
        } catch (syncError) {
          console.error(`[${env}] Sync error:`, syncError);
        }

        // Use exponential backoff with jitter
        backoffTime = Math.min(backoffTime * 1.5, 60000); // Cap at 1 minute
        const jitter = Math.random() * 0.3 * backoffTime; // 0-30% jitter
        const waitTime = backoffTime + jitter;

        console.log(
          `[${env}] Retrying in ${Math.round(waitTime / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
        );
        await sleep(waitTime);
      }
    }
  };

  // Setup watchdog to detect stale connections
  const setupWatchdog = (
    client: Client,
    env: string,
    restartFn: () => Promise<void>,
  ) => {
    // If no restart interval is set, don't set up the watchdog
    if (!WATCHDOG_RESTART_INTERVAL_MS) return;

    let lastRestartTimestamp = Date.now();
    // We'll still track activity for logging purposes
    let lastActivityTimestamp = Date.now();
    const updateActivity = () => {
      lastActivityTimestamp = Date.now();
    };

    const watchdogInterval = setInterval(
      () => {
        const currentTime = Date.now();
        const timeSinceLastRestart = currentTime - lastRestartTimestamp;
        const inactiveTime = currentTime - lastActivityTimestamp;

        // Force restart every WATCHDOG_RESTART_INTERVAL_MS regardless of activity
        if (timeSinceLastRestart > WATCHDOG_RESTART_INTERVAL_MS) {
          console.log(
            `[${env}] Watchdog: Scheduled restart after ${Math.round(timeSinceLastRestart / 1000)}s (inactive for ${Math.round(inactiveTime / 1000)}s)`,
          );

          restartFn()
            .then(() => {
              console.log(
                `[${env}] Watchdog: Connection restarted successfully`,
              );
              lastRestartTimestamp = Date.now();
            })
            .catch((error: unknown) => {
              console.error(`[${env}] Watchdog: Failed to restart:`, error);
            })
            .finally(() => {
              updateActivity();
            });
        }
      },
      Math.min(WATCHDOG_RESTART_INTERVAL_MS / 10, 30000), // Check at least every 30 seconds
    );

    process.on("beforeExit", () => {
      clearInterval(watchdogInterval);
    });
    return updateActivity;
  };

  // Main initialization logic
  const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
  ]);

  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];
  const mergedOptions = { ...DEFAULT_AGENT_OPTIONS, ...options };
  const networks = mergedOptions.networks || ["dev", "production"];

  for (const env of networks) {
    try {
      console.log(`[${env}] Initializing client...`);

      const signer = createSigner(WALLET_KEY);
      const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
      const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
      const signerIdentifier = (await signer.getIdentifier()).identifier;

      const client = await Client.create(signer, {
        dbEncryptionKey,
        env: env as XmtpEnv,
        loggingLevel,
        dbPath: getDbPath(`${env}-${signerIdentifier}`),
      });

      await client.conversations.sync();
      clients.push(client);

      // Create restart function & watchdog
      const restartStream = () =>
        client.conversations
          .sync()
          .then(() => {
            console.log(`[${env}] Forced re-sync completed`);
          })
          .catch((error: unknown) => {
            console.error(`[${env}] Force re-sync failed:`, error);
          });

      const activityTracker = setupWatchdog(client, env, restartStream);

      // Start message streaming
      const streamPromise = streamMessages(
        client,
        messageHandler,
        { ...mergedOptions, networks: [env] },
        activityTracker,
      );

      streamPromises.push(streamPromise);
      console.log(`[${env}] ✓ Client ready and listening for messages`);
    } catch (error) {
      console.error(`[${env}] Client initialization error:`, error);
    }
  }

  if (clients.length > 0) {
    logAgentDetails(clients);
  } else {
    throw new Error("No clients were successfully initialized");
  }

  // Handle graceful shutdowns
  process.on("SIGINT", () => {
    console.log("\nShutting down clients...");
    process.exit(0);
  });

  await Promise.all(streamPromises);
  return clients;
};
