import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { createClient, getDataPath, streamTimeout } from "@helpers/client";
import {
  ConsentState,
  Dm,
  type Client,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import "dotenv/config";
import path from "node:path";
import type { WorkerBase } from "./manager";

export const installationThreshold = 5;
export enum typeOfSync {
  SyncAll = "sync_all",
  Sync = "sync_conversation",
  Both = "both",
  None = "none",
}

export enum typeofStream {
  Message = "message",
  MessageandResponse = "message_and_response",
  GroupUpdated = "group_updated",
  Conversation = "conversation",
  Consent = "consent",
  None = "none",
}
export enum StreamCollectorType {
  Message = "stream_message",
  GroupUpdated = "stream_group_updated",
  Conversation = "stream_conversation",
  Consent = "stream_consent",
}

// Worker thread code as a string
const workerThreadCode = `
import { parentPort, workerData } from "node:worker_threads";
import type { Client } from "@xmtp/node-sdk";

// The Worker must be run in a worker thread, so confirm \`parentPort\` is defined
if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

// Optional logs to see what's being passed into the worker.
console.debug("[Worker] Started with workerData:", workerData);

// Listen for messages from the parent
parentPort.on("worker_message", (message: { type: string; data: any }) => {
  switch (message.type) {
    case "initialize":
      // You can add logs or do any one-time setup here.
      console.debug("[Worker] Received 'initialize' message:", message.data);
      break;

    default:
      console.debug(
        \`[Worker] Received unknown message type: \${message.type}\`,
      );
      break;
  }
});


// Re-export anything needed in the worker environment (if necessary)
export type { Client };
`;
// Bootstrap code that loads the worker thread code
const workerBootstrap = /* JavaScript */ `
  import { parentPort, workerData } from "node:worker_threads";
  
  // Execute the worker code
  const workerCode = ${JSON.stringify(workerThreadCode)};
  const workerModule = new Function('require', 'parentPort', 'workerData', 'process', workerCode);
  
  // Get the require function
  import { createRequire } from "node:module";
  import { fileURLToPath } from "node:url";
  const __filename = fileURLToPath("${import.meta.url}");
  const require = createRequire(__filename);
  
  // Execute the worker code
  workerModule(require, parentPort, workerData, process);
`;

// Define generic message types for different stream events
interface BaseStreamMessage {
  type: string;
}

interface StreamTextMessage extends BaseStreamMessage {
  type: StreamCollectorType.Message;
  message: {
    conversationId: string;
    senderInboxId: string;
    content: string;
    contentType?: {
      typeId: string;
    };
  };
}

interface StreamGroupUpdateMessage extends BaseStreamMessage {
  type: StreamCollectorType.GroupUpdated;
  group: {
    conversationId: string;
    name: string;
    addedInboxes?: Array<{ inboxId: string }>;
  };
}

interface StreamConversationMessage extends BaseStreamMessage {
  type: StreamCollectorType.Conversation;
  conversation: {
    id: string;
  };
}

interface StreamConsentMessage extends BaseStreamMessage {
  type: StreamCollectorType.Consent;
  consentUpdate: {
    inboxId: string;
    consentValue: boolean;
  };
}

type StreamMessage =
  | StreamTextMessage
  | StreamGroupUpdateMessage
  | StreamConversationMessage
  | StreamConsentMessage;

export class WorkerClient extends Worker {
  public name: string;
  public sdk: string;
  private nameId: string;
  private walletKey: string;
  private encryptionKeyHex: string;
  private folder: string;
  public address!: `0x${string}`;
  public client!: Client;
  private env: XmtpEnv;
  private apiUrl?: string;
  private activeStreamTypes: Set<typeofStream> = new Set();
  private streamControllers: Map<typeofStream, AbortController> = new Map();
  private streamReferences: Map<typeofStream, { end?: () => void }> = new Map();
  public dbPath!: string;

  constructor(
    worker: WorkerBase,
    env: XmtpEnv,
    options: WorkerOptions = {},
    apiUrl?: string,
  ) {
    options.workerData = {
      worker,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
    this.name = worker.name;
    this.sdk = worker.sdk;
    this.folder = worker.folder;
    this.env = env;
    this.apiUrl = apiUrl;
    this.nameId = worker.name + "-" + worker.sdk.split("-")[0];
    this.walletKey = worker.walletKey;
    this.encryptionKeyHex = worker.encryptionKey;
    this.setupEventHandlers();
  }

  terminate() {
    // Stop active streams first
    this.stopStreams();
    // Then terminate the worker thread
    return super.terminate();
  }
  async getStats() {
    const stats = await this.client.debugInformation?.apiStatistics();
    let object = {
      "Query Group Messages": stats?.queryGroupMessages.toString(),
      "Query Welcome Messages": stats?.queryWelcomeMessages.toString(),
      "Send Group Messages": stats?.sendGroupMessages.toString(),
      "Send Welcome Messages": stats?.sendWelcomeMessages.toString(),
      "Upload Key Package": stats?.uploadKeyPackage.toString(),
      "Fetch Key Package": stats?.fetchKeyPackage.toString(),
      "Subscribe Messages": stats?.subscribeMessages.toString(),
      "Subscribe Welcomes": stats?.subscribeWelcomes.toString(),
    };
    console.debug(JSON.stringify(object, null, 2));
    this.client.debugInformation.clearAllStatistics();
  }
  /**
   * Stops all active streams without terminating the worker
   */
  stopStreams(): void {
    this.activeStreamTypes.clear();

    // End streams using their .end() method if available, otherwise abort
    for (const [streamType, streamRef] of this.streamReferences.entries()) {
      if (streamRef.end && typeof streamRef.end === "function") {
        try {
          streamRef.end();
        } catch (error) {
          console.warn(
            `[${this.nameId}] Error calling stream.end() for ${streamType}:`,
            error,
          );
        }
      }
    }
    this.streamReferences.clear();

    // Abort all stream controllers as fallback
    for (const controller of this.streamControllers.values()) {
      controller.abort();
    }
    this.streamControllers.clear();
  }

  /**
   * Apply sync strategy by starting sync and streams
   * @param strategy - The sync strategy to apply
   */
  public applySyncStrategy(strategy: SyncStrategy): void {
    console.debug(
      `[${this.nameId}] Applying sync strategy: ${JSON.stringify(strategy)}`,
    );

    // Start sync if specified
    if (strategy.syncType !== typeOfSync.None) {
      this.startSync(strategy.syncType, strategy.syncInterval);
    }

    // Start streams if specified
    for (const streamType of strategy.streamTypes) {
      if (streamType !== typeofStream.None) {
        this.startStream(streamType);
      }
    }
  }

  /**
   * Starts a specific sync type
   * @param syncType - The type of sync to start
   * @param interval - The interval in milliseconds to sync
   */
  public startSync(syncType: typeOfSync, interval: number = 10000): void {
    if (syncType === typeOfSync.None) {
      return;
    }

    console.debug(`[${this.nameId}] Starting ${syncType} sync`);
    void (async () => {
      while (true) {
        if (syncType === typeOfSync.SyncAll) {
          console.debug(`[${this.nameId}] Starting ${syncType} sync`);
          await this.client.conversations.syncAll();
        } else if (syncType === typeOfSync.Sync) {
          await this.client.conversations.sync();
        } else if (syncType === typeOfSync.Both) {
          await this.client.conversations.syncAll();
          await this.client.conversations.sync();
        }

        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    })();
  }

  /**
   * Starts a specific stream type
   * @param streamType - The type of stream to start
   */
  public startStream(streamType: typeofStream): void {
    if (streamType === typeofStream.None) {
      return;
    }

    if (this.activeStreamTypes.has(streamType)) {
      console.debug(`[${this.nameId}] Stream ${streamType} is already active`);
      return;
    }

    this.activeStreamTypes.add(streamType);

    try {
      switch (streamType) {
        case typeofStream.Message:
          this.initMessageStream(typeofStream.Message);
          break;
        case typeofStream.MessageandResponse:
          this.initMessageStream(typeofStream.MessageandResponse);
          break;
        case typeofStream.GroupUpdated:
          this.initMessageStream(typeofStream.GroupUpdated);
          break;
        case typeofStream.Conversation:
          this.initConversationStream();
          break;
        case typeofStream.Consent:
          this.initConsentStream();
          break;
      }
      console.debug(`[${this.nameId}] Started ${streamType} stream`);
    } catch (error) {
      console.error(
        `[${this.nameId}] Failed to start ${streamType} stream:`,
        error,
      );
      this.activeStreamTypes.delete(streamType);
      throw error;
    }
  }

  /**
   * Stops streams - all streams if no parameter, or a specific stream type
   * @param streamType - Optional specific stream type to stop. If not provided, stops all streams
   */
  public endStream(streamType?: typeofStream): void {
    if (streamType) {
      console.debug(`[${this.nameId}] Stopping ${streamType} stream`);
      this.activeStreamTypes.delete(streamType);

      // End the stream using its .end() method if available
      const streamRef = this.streamReferences.get(streamType);
      if (streamRef?.end && typeof streamRef.end === "function") {
        try {
          streamRef.end();
        } catch (error) {
          console.warn(
            `[${this.nameId}] Error calling stream.end() for ${streamType}:`,
            error,
          );
        }
      }
      this.streamReferences.delete(streamType);

      // Abort the specific stream controller as fallback
      const controller = this.streamControllers.get(streamType);
      if (controller) {
        controller.abort();
        this.streamControllers.delete(streamType);
      }
    } else {
      console.debug(`[${this.nameId}] Stopping all streams`);
      this.stopStreams();
    }
  }

  /**
   * Gets the current folder identifier for this worker
   */
  get currentFolder(): string {
    return this.folder;
  }
  async getSQLiteFileSizes(): Promise<{
    dbFile: number;
    walFile: number;
    shmFile: number;
    total: number;
    conversations: number;
  }> {
    const dbPath = this.dbPath;
    // Get the directory containing the database file
    const dbDir = path.dirname(dbPath);
    const dbFileName = path.basename(dbPath);

    const files = fs.readdirSync(dbDir);
    const sizes = {
      dbFile: 0,
      walFile: 0,
      shmFile: 0,
      total: 0,
      conversations: 0,
    };
    for (const file of files) {
      const filePath = path.join(dbDir, file);

      // Only consider files that start with our database name
      if (!file.startsWith(dbFileName)) {
        continue;
      }

      const stats = fs.statSync(filePath);

      const conversations = await this.client.conversations.list();
      sizes.conversations = conversations.length;
      if (file === dbFileName) {
        sizes.dbFile = stats.size;
      } else if (file.endsWith("-wal")) {
        sizes.walFile = stats.size;
      } else if (file.endsWith("-shm")) {
        sizes.shmFile = stats.size;
      }
      sizes.total = sizes.dbFile + sizes.walFile + sizes.shmFile;
    }
    const formatBytes = (bytes: number) => {
      return Math.round(bytes / (1024 * 1024));
    };
    const formattedSizes = {
      dbFile: formatBytes(sizes.dbFile),
      walFile: formatBytes(sizes.walFile),
      shmFile: formatBytes(sizes.shmFile),
      conversations: sizes.conversations,
      total: formatBytes(sizes.total),
    };

    // console.debug(
    //   `[${this.nameId}] SQLite file sizes: ${JSON.stringify(formattedSizes, null, 2)}`,
    // );
    return formattedSizes;
  }

  /**
   * Reinstalls the worker
   */
  public async reinstall(): Promise<void> {
    console.debug(`[${this.nameId}] Reinstalling worker`);
    // Stop active streams first
    this.stopStreams();
    // Then terminate the worker thread
    await super.terminate();
    await this.clearDB();
    await this.initialize();
  }

  private setupEventHandlers() {
    // Log messages from the Worker
    this.on("worker_message", (message) => {
      console.debug(`[${this.nameId}] Worker message:`, message);
    });

    // Handle Worker errors
    this.on("error", (error) => {
      console.error(`[${this.nameId}] Worker error:`, error);
    });

    // Handle Worker exit
    this.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[${this.nameId}] Worker stopped with exit code ${code}`);
      }
    });
  }

  /**
   * Initializes the underlying XMTP client in the Worker.
   * Returns the XMTP Client object for convenience.
   */
  async initialize(): Promise<{
    client: Client;
    dbPath: string;
    installationId: string;
    address: `0x${string}`;
  }> {
    // Tell the Worker to do any internal initialization
    this.postMessage({
      type: "initialize",
      data: {
        name: this.name,
        folder: this.folder,
        sdk: this.sdk,
      },
    });
    const { client, dbPath, address } = await createClient(
      this.walletKey as `0x${string}`,
      this.encryptionKeyHex,
      this.sdk,
      this.name,
      this.folder,
      this.env,
      this.apiUrl,
    );

    this.dbPath = dbPath;
    this.client = client as Client;
    this.address = address;

    const installationId = this.client.installationId;

    return {
      client: this.client,
      dbPath,
      address: address,
      installationId,
    };
  }

  /**
   * Initialize message stream for both regular messages and group updates
   */
  private initMessageStream(type: typeofStream) {
    // Create abort controller for this stream
    const controller = new AbortController();
    this.streamControllers.set(type, controller);

    void (async () => {
      while (this.activeStreamTypes.has(type) && !controller.signal.aborted) {
        try {
          const stream = await this.client.conversations.streamAllMessages();

          // Store stream reference with .end() method if available, otherwise create mock
          const streamRef = stream as any;
          this.streamReferences.set(type, {
            end:
              streamRef.end ||
              (() => {
                // Mock end function - signals to stop the stream loop
                console.debug(`[${this.nameId}] Mock ending ${type} stream`);
                controller.abort();
              }),
          });
          for await (const message of stream) {
            console.debug(
              `[${this.nameId}] Received message`,
              JSON.stringify(message, null, 2),
            );
            if (!this.activeStreamTypes.has(type) || controller.signal.aborted)
              break;

            if (
              !message ||
              message?.senderInboxId.toLowerCase() ===
                this.client.inboxId.toLowerCase()
            ) {
              continue;
            }
            if (
              message?.contentType?.typeId === "group_updated" &&
              type === typeofStream.GroupUpdated
            ) {
              console.debug(
                `Received group updated ${JSON.stringify(message.content)}`,
              );
              if (this.listenerCount("worker_message") > 0) {
                // Extract group name from metadata changes
                const content = message.content as {
                  metadataFieldChanges?: Array<{
                    fieldName: string;
                    oldValue: string;
                    newValue: string;
                  }>;
                  addedInboxes?: Array<{ inboxId: string }>;
                  initiatedByInboxId?: string;
                };

                const groupName =
                  content.metadataFieldChanges?.find(
                    (change) => change.fieldName === "group_name",
                  )?.newValue || "Unknown";

                this.emit("worker_message", {
                  type: StreamCollectorType.GroupUpdated,
                  group: {
                    conversationId: message.conversationId,
                    name: groupName,
                    addedInboxes: content.addedInboxes,
                  },
                });
              }
              continue;
            } else if (
              //Check
              type === typeofStream.Message ||
              type === typeofStream.MessageandResponse
            ) {
              // Log message details for debugging
              // console.debug(
              //   `[${this.nameId}] Message details: conversationId=${message.conversationId}, senderInboxId=${message.senderInboxId}, myInboxId=${this.client.inboxId}`,
              // );

              // Handle auto-responses if enabled
              await this.handleResponse(message, type);

              // Emit standard message
              if (this.listenerCount("worker_message") > 0) {
                // console.debug(
                //   `[${this.nameId}] Emitting message to ${this.listenerCount("worker_message")} listeners: "${message.content as string}"`,
                // );
                this.emit("worker_message", {
                  type: StreamCollectorType.Message,
                  message: {
                    conversationId: message.conversationId,
                    senderInboxId: message.senderInboxId,
                    content: message.content as string,
                    contentType: message.contentType,
                  },
                });
              } else {
                // console.debug(
                //   `[${this.nameId}] No listeners for worker_message, skipping emit for: "${message.content as string}"`,
                // );
              }
            } else {
              // // Log non-text messages for debugging
              // console.debug(
              //   `[${this.nameId}] Received NON-TEXT message: contentType=${message.contentType?.typeId}, streamType=${type}`,
              // );
            }
          }
        } catch (error) {
          console.error(`[${this.nameId}] message stream: ${String(error)}`);
          throw error;
        }
      }
    })();
  }

  /**
   * Handle generating and sending GPT responses
   */
  private async handleResponse(
    message: DecodedMessage,
    streamType: typeofStream,
  ) {
    try {
      // Filter out messages from the same client
      if (message.senderInboxId === this.client.inboxId) {
        console.warn(
          `[${this.nameId}] Skipping message from self, ${message.content as string}`,
        );
        return;
      }
      // Only respond if this is a MessageandResponse stream
      if (streamType !== typeofStream.MessageandResponse) {
        return;
      }

      const conversation = await this.client.conversations.getConversationById(
        message.conversationId,
      );
      if (!conversation) {
        console.warn(
          `[${this.nameId}] Skipping message, conversation not found`,
        );
        return;
      }
      const baseName = this.name.split("-")[0].toLowerCase();
      const isDm = conversation instanceof Dm;
      const content = (message.content as string).toLowerCase();
      let shouldRespond = false;
      if (
        ((message?.contentType?.typeId === "text" ||
          message?.contentType?.typeId === "reaction" ||
          message?.contentType?.typeId === "reply") &&
          content.includes(baseName) &&
          !content.includes("/") &&
          !content.includes("workers") &&
          !content.includes("members") &&
          !content.includes("admins")) ||
        isDm
      ) {
        shouldRespond = true;
      }
      if (!shouldRespond) {
        // console.warn(
        //   `[${this.nameId}] Skipping message, shouldRespond is ${shouldRespond}`,
        // );
        return;
      }
      let response = `${this.nameId} says: gm from sdk ${this.sdk}`;
      if (conversation && conversation.debugInfo !== undefined) {
        const debugInfo = await conversation.debugInfo();
        response += ` and epoch ${debugInfo?.epoch}`;
      }
      await conversation.send(response);
    } catch (error) {
      console.error(`[${this.nameId}] Error generating response:`, error);
    }
  }

  /**
   * Initialize conversation stream
   */
  private initConversationStream() {
    const streamType = typeofStream.Conversation;
    // Create abort controller for this stream
    const controller = new AbortController();
    this.streamControllers.set(streamType, controller);

    void (async () => {
      while (
        this.activeStreamTypes.has(streamType) &&
        !controller.signal.aborted
      ) {
        try {
          const stream = this.client.conversations.stream();

          // Store stream reference with .end() method if available, otherwise create mock
          const streamRef = stream as any;
          this.streamReferences.set(streamType, {
            end:
              streamRef.end ||
              (() => {
                // Mock end function - signals to stop the stream loop
                console.debug(
                  `[${this.nameId}] Mock ending ${streamType} stream`,
                );
                controller.abort();
              }),
          });
          for await (const conversation of stream) {
            try {
              console.debug(
                `Received conversation, conversationId: ${conversation?.id}`,
              );
              if (
                !this.activeStreamTypes.has(streamType) ||
                controller.signal.aborted
              ) {
                console.debug(`Stopping conversation stream`);
                break;
              }
              if (!conversation?.id) {
                console.debug(
                  `Skipping conversation, ${JSON.stringify(conversation, null, 2)}`,
                );
                continue;
              }

              if (this.listenerCount("worker_message") > 0) {
                this.emit("worker_message", {
                  type: StreamCollectorType.Conversation,
                  conversation,
                });
              }
            } catch (error) {
              console.error(
                `[${this.nameId}] conversation stream error: ${String(error)}`,
              );
              throw error;
            }
          }
        } catch (error) {
          console.error(
            `[${this.nameId}] conversation stream error: ${String(error)}`,
          );
          throw error;
        }
      }
    })();
  }

  /**
   * Initialize consent stream
   */
  private initConsentStream() {
    const streamType = typeofStream.Consent;
    // Create abort controller for this stream
    const controller = new AbortController();
    this.streamControllers.set(streamType, controller);

    void (async () => {
      while (
        this.activeStreamTypes.has(streamType) &&
        !controller.signal.aborted
      ) {
        try {
          const stream = await this.client.preferences.streamConsent();

          const streamRef = stream as any;
          this.streamReferences.set(streamType, {
            end:
              streamRef.end ||
              (() => {
                // Mock end function - signals to stop the stream loop
                console.debug(
                  `[${this.nameId}] Mock ending ${streamType} stream`,
                );
                controller.abort();
              }),
          });

          for await (const consentUpdate of stream) {
            console.debug(
              `Received consent update, ${JSON.stringify(consentUpdate, null, 2)}`,
            );
            if (this.listenerCount("worker_message") > 0) {
              // Process each consent setting in the array
              if (Array.isArray(consentUpdate) && consentUpdate.length > 0) {
                for (const consent of consentUpdate) {
                  // Ensure we're properly formatting the event for our collectors
                  const consentEvent = {
                    type: StreamCollectorType.Consent,
                    consentUpdate: {
                      inboxId:
                        typeof consent.entity === "string"
                          ? consent.entity
                          : "",
                      consentValue: consent.state === ConsentState.Allowed, // Convert to boolean based on proper enum
                    },
                  };

                  this.emit("worker_message", consentEvent);
                }
              } else {
                console.error(
                  `Skipping empty consent update, ${JSON.stringify(consentUpdate, null, 2)}`,
                );
                throw new Error("Empty consent update");
              }
            }
          }
        } catch (error) {
          console.error(
            `[${this.nameId}] consent stream error: ${String(error)}`,
          );
        }
      }
    })();
  }

  /**
   * Collects stream events of specified type
   */
  collectStreamEvents<T extends StreamMessage>(options: {
    type: typeofStream;
    filterFn?: (msg: StreamMessage) => boolean;
    count: number;
    customTimeout?: number;
  }): Promise<T[]> {
    const { type, filterFn, count, customTimeout = streamTimeout } = options;

    // Create unique collector ID to prevent conflicts
    const collectorId = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return new Promise((resolve) => {
      const events: T[] = [];
      let resolved = false;

      const onMessage = (msg: StreamMessage) => {
        // Map from typeofStream to StreamCollectorType
        const streamTypeMap: Record<typeofStream, StreamCollectorType | null> =
          {
            [typeofStream.Message]: StreamCollectorType.Message,
            [typeofStream.MessageandResponse]: StreamCollectorType.Message,
            [typeofStream.GroupUpdated]: StreamCollectorType.GroupUpdated,
            [typeofStream.Conversation]: StreamCollectorType.Conversation,
            [typeofStream.Consent]: StreamCollectorType.Consent,
            [typeofStream.None]: null,
          };

        const expectedType = streamTypeMap[type];
        const isRightType = expectedType !== null && msg.type === expectedType;
        const passesFilter = !filterFn || filterFn(msg);

        console.debug(
          `[${this.nameId}] Collector ${collectorId} evaluating message: isRightType=${isRightType}, passesFilter=${passesFilter}`,
        );

        if (isRightType && passesFilter) {
          events.push(msg as T);
          console.debug(
            `[${this.nameId}] Collector ${collectorId} accepted message, collected ${events.length}/${count}`,
          );

          if (events.length >= count) {
            resolved = true;
            this.off("worker_message", onMessage);
            clearTimeout(timeoutId);
            console.debug(
              `[${this.nameId}] Collector ${collectorId} completed successfully with ${events.length} events`,
            );
            resolve(events);
          }
        } else {
          console.debug(
            `[${this.nameId}] Collector ${collectorId} rejected message`,
          );
        }
      };

      this.on("worker_message", onMessage);

      // Add timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.off("worker_message", onMessage);
          console.error(
            `[${this.nameId}] Collector timed out. ${
              customTimeout / 1000
            }s. Expected ${count} events of type ${type}, collected ${events.length} events.`,
          );

          resolve(events);
        }
      }, customTimeout);
    });
  }

  /**
   * Collect messages with specific criteria
   */
  collectMessages(
    groupId: string,
    count: number,
    types: string[] = ["text"],
    customTimeout?: number,
  ): Promise<StreamTextMessage[]> {
    // console.debug(
    //   `[${this.nameId}] Starting collectMessages for conversationId: ${groupId}, expecting ${count} messages`,
    // );
    return this.collectStreamEvents<StreamTextMessage>({
      type: typeofStream.Message,
      filterFn: (msg) => {
        // console.debug(
        //   `[${this.nameId}] Filtering message: type=${msg.type}, expected=${StreamCollectorType.Message}`,
        // );

        if (msg.type !== StreamCollectorType.Message) {
          return false;
        }

        const streamMsg = msg;
        const conversationId = streamMsg.message.conversationId;
        const contentType = streamMsg.message.contentType;
        const idsMatch = groupId === conversationId;
        const typeIsText = types.includes(contentType?.typeId as string);
        const shouldAccept = idsMatch && typeIsText;
        return shouldAccept;
      },
      count,
      customTimeout,
    });
  }
  /**
   * Collect group update messages for a specific group
   */
  collectGroupUpdates(
    groupId: string,
    count: number,
    customTimeout?: number,
  ): Promise<StreamGroupUpdateMessage[]> {
    return this.collectStreamEvents<StreamGroupUpdateMessage>({
      type: typeofStream.GroupUpdated,
      filterFn: (msg) => {
        if (msg.type !== StreamCollectorType.GroupUpdated) {
          console.debug(
            `[${this.nameId}] Type mismatch: ${msg.type} !== ${StreamCollectorType.GroupUpdated}`,
          );
          return false;
        }

        const streamMsg = msg;

        const matches = groupId === streamMsg.group?.conversationId;
        //console.debug(`[${this.nameId}] Group ID match: ${matches}`);

        return matches;
      },
      count,
      customTimeout,
    });
  }

  collectAddedMembers(
    groupId: string,
    count: number = 1,
    customTimeout?: number,
  ): Promise<StreamGroupUpdateMessage[]> {
    return this.collectStreamEvents<StreamGroupUpdateMessage>({
      type: typeofStream.GroupUpdated,
      filterFn: (msg) => {
        if (msg.type !== StreamCollectorType.GroupUpdated) return false;
        const streamMsg = msg;
        const matches = groupId === streamMsg.group.conversationId;
        // Also check if this group update contains added members
        const hasAddedMembers = Boolean(
          streamMsg.group.addedInboxes &&
            streamMsg.group.addedInboxes.length > 0,
        );
        return matches && hasAddedMembers;
      },
      count,
      customTimeout,
    });
  }
  /**
   * Collect conversations
   */
  collectConversations(
    fromInboxId: string,
    count: number = 1,
    customTimeout?: number,
  ): Promise<StreamConversationMessage[]> {
    return this.collectStreamEvents<StreamConversationMessage>({
      type: typeofStream.Conversation,
      filterFn: fromInboxId
        ? (msg) => {
            if (msg.type !== StreamCollectorType.Conversation) return false;
            return msg.conversation.id !== undefined;
          }
        : undefined,
      count,
      customTimeout,
    });
  }

  /**
   * Collect consent updates
   */
  collectConsentUpdates(count: number = 1): Promise<StreamConsentMessage[]> {
    return this.collectStreamEvents<StreamConsentMessage>({
      type: typeofStream.Consent,
      count,
    });
  }

  /**
   * Clears the database for this worker
   * @returns true if the database was cleared, false otherwise
   */
  clearDB(): Promise<boolean> {
    const dataPath = getDataPath() + "/" + this.name + "/" + this.folder;
    console.debug(`[${this.nameId}] Clearing database at ${dataPath}`);

    try {
      if (fs.existsSync(dataPath)) {
        fs.rmSync(dataPath, { recursive: true, force: true });
      }
      return Promise.resolve(true);
    } catch (error) {
      console.error(`[${this.nameId}] Error clearing database:`, error);
      return Promise.resolve(false);
    }
  }

  /**
   * Checks and manages installations for this specific worker
   * @param targetCount - Target number of installations for this worker
   * @returns Current installation count after operations
   */
  async checkAndManageInstallations(targetCount: number): Promise<number> {
    const installations = await this.client.preferences.inboxState();
    const currentCount = installations.installations.length;

    console.debug(
      `[${this.name}] Current installations: ${currentCount}, Target: ${targetCount}`,
    );

    if (currentCount === targetCount) {
      console.debug(`[${this.name}] Installation count matches target`);
      return currentCount;
    } else if (currentCount > targetCount) {
      console.debug(
        `[${this.name}] Too many installations (${currentCount}), revoking all others`,
      );
      await this.addNewInstallation();
      return currentCount + 1;
    } else if (currentCount < targetCount) {
      console.debug(
        `[${this.name}] Not enough installations (${currentCount}), adding new installation`,
      );
      for (let i = 0; i < targetCount - currentCount; i++) {
        await this.addNewInstallation();
      }
      return targetCount;
    }

    return currentCount;
  }

  /**
   * Checks installation age and warns about old installations
   */
  async checkInstallationAge(): Promise<void> {
    const installations = await this.client.preferences.inboxState();

    for (const installation of installations.installations) {
      // Convert nanoseconds to milliseconds for Date constructor
      const timestampMs = Number(installation.clientTimestampNs) / 1_000_000;
      const installationDate = new Date(timestampMs);
      const now = new Date();
      const diffMs = now.getTime() - installationDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const daysText = diffDays === 1 ? "day" : "days";
      const greenCheck = diffDays < 90 ? " ✅" : "❌";

      if (diffDays > 90) {
        console.warn(
          `[${this.name}] Installation: ${diffDays} ${daysText} ago${greenCheck}`,
        );
      }
    }
  }

  /**
   * Revokes installations above a threshold count
   * @param threshold - Maximum number of installations allowed
   */
  async revokeExcessInstallations(
    threshold: number = installationThreshold,
  ): Promise<void> {
    const installations = await this.client.preferences.inboxState();
    if (installations.installations.length > threshold) {
      await this.client.revokeAllOtherInstallations();
      const updatedInstallations = await this.client.preferences.inboxState();
      console.warn(
        `[${this.name}] Installations after revocation: ${updatedInstallations.installations.length}`,
      );
    }
  }

  /**
   * Gets the next alphabetical folder name for this worker
   */
  private getNextAlphabeticalFolder(): string {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const baseName = this.name.split("-")[0];
    const dataPath = getDataPath() + "/" + baseName;

    // Find existing folders for this worker
    const existingFolders = new Set<string>();
    if (fs.existsSync(dataPath)) {
      const folders = fs.readdirSync(dataPath);
      folders.forEach((folder) => {
        // Only consider single letter folders (a, b, c, etc.) and numbered variants (a1, a2, etc.)
        if (/^[a-z](\d+)?$/.test(folder)) {
          existingFolders.add(folder);
        }
      });
    }

    // Find the next available letter
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!existingFolders.has(letter)) {
        return letter;
      }
    }

    // If all letters are taken, start with numbered variants
    let numIndex = 1;
    while (true) {
      const newId = `a${numIndex}`;
      if (!existingFolders.has(newId)) {
        return newId;
      }
      numIndex++;
    }
  }

  /**
   * Adds a new installation to this worker, replacing the existing one
   * This will stop current streams, create a fresh client installation, and restart all services
   * @returns The new installation details
   */
  async addNewInstallation(): Promise<{
    client: Client;
    dbPath: string;
    installationId: string;
    address: `0x${string}`;
  }> {
    console.debug(
      `[${this.nameId}] Adding new installation and replacing current one`,
    );

    // Stop current streams and clear resources
    this.stopStreams();

    // Store old installation ID for logging
    const oldInstallationId = this.client?.installationId;

    // Generate the next alphabetical folder name for the new installation
    const newFolder = this.getNextAlphabeticalFolder();

    // Create a fresh client with new installation using a different folder
    const { client, dbPath, address } = await createClient(
      this.walletKey as `0x${string}`,
      this.encryptionKeyHex,
      this.sdk,
      this.name,
      newFolder,
      this.env,
    );

    // Update worker properties with new client and folder
    this.dbPath = dbPath;
    this.client = client as Client;
    this.address = address;
    this.folder = newFolder; // Update folder reference

    const newInstallationId = this.client.installationId;

    console.debug(
      `[${this.nameId}] Successfully replaced installation ${oldInstallationId} with ${newInstallationId}`,
    );

    return {
      client: this.client,
      dbPath,
      address: address,
      installationId: newInstallationId,
    };
  }
}
