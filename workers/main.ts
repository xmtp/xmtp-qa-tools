import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { createClient, getDataPath } from "@helpers/client";
import { defaultValues } from "@helpers/utils";
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

// Default timeout for stream collection in milliseconds
const DEFAULT_STREAM_TIMEOUT_MS = process.env.DEFAULT_STREAM_TIMEOUT_MS
  ? parseInt(process.env.DEFAULT_STREAM_TIMEOUT_MS)
  : defaultValues.streamTimeout; // 3 seconds

export enum typeOfResponse {
  Gm = "gm",
  Gpt = "gpt",
  None = "none",
}
export enum typeOfSync {
  SyncAll = "sync_all",
  Sync = "sync_conversation",
  Both = "both",
  None = "none",
}
export enum typeofStream {
  Message = "message",
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
    peerAddress?: string;
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
  private testName: string;
  private nameId: string;
  private walletKey: string;
  private encryptionKeyHex: string;
  private typeofStream: typeofStream;
  private typeofSync: typeOfSync;
  private typeOfResponse: typeOfResponse;
  private folder: string;
  private sdkVersion: string;
  private libXmtpVersion: string;
  public address!: `0x${string}`;
  public client!: Client;
  private env: XmtpEnv;
  private activeStreams: boolean = false;
  public dbPath!: string;

  constructor(
    worker: WorkerBase,
    typeofStream: typeofStream,
    typeOfResponse: typeOfResponse,
    typeofSync: typeOfSync,
    env: XmtpEnv,
    options: WorkerOptions = {},
  ) {
    options.workerData = {
      worker,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
    this.typeofSync = typeofSync;
    this.typeOfResponse = typeOfResponse;
    this.typeofStream = typeofStream;
    this.name = worker.name;
    this.sdkVersion = worker.sdkVersion;
    this.libXmtpVersion = worker.libXmtpVersion;
    this.folder = worker.folder;
    this.env = env;
    this.nameId = worker.name + "-" + worker.sdkVersion;
    this.testName = worker.testName;
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

  /**
   * Stops all active streams without terminating the worker
   */
  stopStreams(): void {
    this.activeStreams = false;
  }

  /**
   * Gets the current folder identifier for this worker
   */
  get currentFolder(): string {
    return this.folder;
  }
  async getSQLiteFileSizes() {
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

    // const formattedSizes = {
    //   dbFile: formatBytes(sizes.dbFile),
    //   walFile: formatBytes(sizes.walFile),
    //   shmFile: formatBytes(sizes.shmFile),
    //   conversations: sizes.conversations,
    //   total: formatBytes(sizes.total),
    // };

    // console.debug(
    //   `[${this.nameId}] SQLite file sizes: ${JSON.stringify(formattedSizes, null, 2)}`,
    // );
    return sizes;
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
        sdkVersion: this.sdkVersion,
        libXmtpVersion: this.libXmtpVersion,
      },
    });
    const { client, dbPath, address } = await createClient(
      this.walletKey as `0x${string}`,
      this.encryptionKeyHex,
      {
        sdkVersion: this.sdkVersion,
        name: this.name,
        testName: this.testName,
        folder: this.folder,
      },
      this.env,
    );

    this.dbPath = dbPath;
    this.client = client as Client;
    this.address = address;

    this.startStream();
    this.startSyncs();

    const installationId = this.client.installationId;

    return {
      client: this.client,
      dbPath,
      address: address,
      installationId,
    };
  }

  /**
   * Starts a periodic sync of all conversations
   * @param interval - The interval in milliseconds to sync
   */
  private startSyncs(interval: number = 10000) {
    if (this.typeofSync !== typeOfSync.None) {
      //console.debug(`[${this.nameId}] Starting ${this.typeofSync} sync`);
      void (async () => {
        while (true) {
          if (this.typeofSync === typeOfSync.SyncAll) {
            await this.client.conversations.syncAll();
          } else if (this.typeofSync === typeOfSync.Sync) {
            await this.client.conversations.sync();
          } else if (this.typeofSync === typeOfSync.Both) {
            await this.client.conversations.syncAll();
            await this.client.conversations.sync();
          }

          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      })();
    }
  }

  /**
   * Unified method to start the appropriate stream based on configuration
   */
  private startStream() {
    try {
      switch (this.typeofStream) {
        case typeofStream.Message:
          this.initMessageStream(typeofStream.Message);
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
        // Add additional stream types as needed
      }
    } catch (error) {
      console.error(
        `[${this.nameId}] Failed to start ${this.typeofStream} stream:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Initialize message stream for both regular messages and group updates
   */
  private initMessageStream(type: typeofStream) {
    this.activeStreams = true;
    void (async () => {
      while (this.activeStreams) {
        try {
          const stream = await this.client.conversations.streamAllMessages();
          for await (const message of stream) {
            if (!this.activeStreams) break;

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
                `Received group updated ${JSON.stringify(message.content, null, 2)}`,
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
            }
            if (
              message.contentType?.typeId === "text" &&
              type === typeofStream.Message
            ) {
              console.debug(
                `[${this.nameId}] Received message, ${message.content as string}`,
              );
              // Handle auto-responses if enabled
              await this.handleResponse(message);

              // Emit standard message
              if (this.listenerCount("worker_message") > 0) {
                this.emit("worker_message", {
                  type: StreamCollectorType.Message,
                  message, // This is the DecodedMessage object
                });
              }
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
  private async handleResponse(message: DecodedMessage) {
    try {
      // Filter out messages from the same client
      if (message.senderInboxId === this.client.inboxId) {
        console.warn(
          `[${this.nameId}] Skipping message from self, ${message.content as string}`,
        );
        return;
      }
      if (this.typeOfResponse === typeOfResponse.None) {
        console.warn(
          `[${this.nameId}] Skipping message, typeOfResponse is ${this.typeOfResponse}`,
        );
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
        (message?.contentType?.typeId === "text" &&
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
        console.warn(
          `[${this.nameId}] Skipping message, shouldRespond is ${shouldRespond}`,
        );
        return;
      }

      const debugInfo = await conversation?.debugInfo();
      await conversation?.send(
        `${this.nameId} says: gm from epoch ${debugInfo?.epoch}`,
      );
    } catch (error) {
      console.error(`[${this.nameId}] Error generating response:`, error);
    }
  }

  /**
   * Initialize conversation stream
   */
  private initConversationStream() {
    this.activeStreams = true;
    void (async () => {
      while (this.activeStreams) {
        try {
          const stream = this.client.conversations.stream();
          for await (const conversation of stream) {
            try {
              console.debug(
                `Received conversation, conversationId: ${conversation?.id}`,
              );
              if (!this.activeStreams) {
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
    this.activeStreams = true;
    void (async () => {
      while (this.activeStreams) {
        try {
          const stream = await this.client.preferences.streamConsent();

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
    additionalInfo?: Record<string, string | number | boolean>;
  }): Promise<T[]> {
    const { type, filterFn, count } = options;

    return new Promise((resolve) => {
      const events: T[] = [];
      const onMessage = (msg: StreamMessage) => {
        // Map from typeofStream to StreamCollectorType
        const streamTypeMap: Record<typeofStream, StreamCollectorType | null> =
          {
            [typeofStream.Message]: StreamCollectorType.Message,
            [typeofStream.GroupUpdated]: StreamCollectorType.GroupUpdated,
            [typeofStream.Conversation]: StreamCollectorType.Conversation,
            [typeofStream.Consent]: StreamCollectorType.Consent,
            [typeofStream.None]: null,
          };

        const expectedType = streamTypeMap[type];
        const isRightType = expectedType !== null && msg.type === expectedType;
        const passesFilter = !filterFn || filterFn(msg);

        if (isRightType && passesFilter) {
          events.push(msg as T);
          if (events.length >= count) {
            this.off("worker_message", onMessage);
            clearTimeout(timeoutId);
            resolve(events);
          }
        }
      };

      this.on("worker_message", onMessage);

      // Add timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        this.off("worker_message", onMessage);
        console.error(
          `[${this.nameId}] Stream collection timed out. ${
            DEFAULT_STREAM_TIMEOUT_MS / 1000
          }s.`,
        );
        resolve(events); // Resolve with whatever events we've collected so far
      }, DEFAULT_STREAM_TIMEOUT_MS);
    });
  }

  /**
   * Collect messages with specific criteria
   */
  collectMessages(
    groupId: string,
    count: number,
  ): Promise<StreamTextMessage[]> {
    return this.collectStreamEvents<StreamTextMessage>({
      type: typeofStream.Message,
      filterFn: (msg) => {
        if (msg.type !== StreamCollectorType.Message) return false;
        const streamMsg = msg; // Type assertion is fine after the check
        const conversationId = streamMsg.message.conversationId;
        const contentType = streamMsg.message.contentType;
        const idsMatch = groupId === conversationId;
        const typeIsText = contentType?.typeId === "text";
        return idsMatch && typeIsText;
      },
      count,
      additionalInfo: {
        collector: "collectMessages",
        expectedGroupId: groupId,
      }, // Pass groupId for better logging
    });
  }

  /**
   * Collect group update messages for a specific group
   */
  collectGroupUpdates(
    groupId: string,
    count: number,
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
        console.debug(`[${this.nameId}] Group ID match: ${matches}`);

        return matches;
      },
      count,
      additionalInfo: { groupId },
    });
  }

  collectAddedMembers(
    groupId: string,
    count: number = 1,
  ): Promise<StreamConversationMessage[]> {
    const additionalInfo: Record<string, string | number | boolean> = {
      groupId,
    };

    return this.collectStreamEvents<StreamConversationMessage>({
      type: typeofStream.Conversation,
      filterFn: (msg) => {
        if (msg.type !== StreamCollectorType.Conversation) return false;
        const streamMsg = msg;
        const matches = groupId === streamMsg.conversation.id;
        return matches;
      },
      count,
      additionalInfo,
    });
  }
  /**
   * Collect conversations
   */
  collectConversations(
    fromPeerAddress: string,
    count: number = 1,
    conversationId?: string,
  ): Promise<StreamConversationMessage[]> {
    const additionalInfo: Record<string, string | number | boolean> = {
      fromPeerAddress,
    };

    if (conversationId) {
      additionalInfo.conversationId = conversationId;
    }

    return this.collectStreamEvents<StreamConversationMessage>({
      type: typeofStream.Conversation,
      filterFn: conversationId
        ? (msg) => {
            if (msg.type !== StreamCollectorType.Conversation) return false;
            return msg.conversation.id === conversationId;
          }
        : undefined,
      count,
      additionalInfo,
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
  async revokeExcessInstallations(threshold: number = 10): Promise<void> {
    const installations = await this.client.preferences.inboxState();
    if (installations.installations.length > threshold) {
      await this.client.revokeAllOtherInstallations();
      const updatedInstallations =
        await this.client.preferences.inboxState(true);
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
      {
        sdkVersion: this.sdkVersion,
        name: this.name,
        testName: this.testName,
        folder: newFolder, // Use new folder to ensure new database/installation
      },
      this.env,
    );

    // Update worker properties with new client and folder
    this.dbPath = dbPath;
    this.client = client as Client;
    this.address = address;
    this.folder = newFolder; // Update folder reference

    // Restart streams and syncs with new installation
    this.startStream();
    this.startSyncs();

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
