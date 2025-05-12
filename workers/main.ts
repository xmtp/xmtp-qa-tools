import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { generateOpenAIResponse } from "@helpers/ai";
import { createClient, getDataPath } from "@helpers/client";
import { defaultValues } from "@helpers/tests";
import {
  ConsentState,
  Dm,
  type Client,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import type { WorkerBase } from "./manager";

// Default timeout for stream collection in milliseconds
const DEFAULT_STREAM_TIMEOUT_MS = defaultValues.streamTimeout; // 3 seconds

export enum typeOfResponse {
  Gm = "gm",
  Gpt = "gpt",
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
  private typeOfResponse: typeOfResponse;
  private folder: string;
  private sdkVersion: string;
  private libXmtpVersion: string;
  public address!: `0x${string}`;
  public client!: Client;
  private env: XmtpEnv;
  private activeStreams: boolean = false;

  constructor(
    worker: WorkerBase,
    typeofStream: typeofStream,
    typeOfResponse: typeOfResponse,
    env: XmtpEnv,
    options: WorkerOptions = {},
  ) {
    options.workerData = {
      worker,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

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

    this.client = client as Client;
    this.address = address;

    this.startStream();

    const installationId = this.client.installationId;

    return {
      client: this.client,
      dbPath,
      address: address,
      installationId,
    };
  }

  // private startParallelStreams() {
  //   void Promise.all([
  //     this.initMessageStream(typeofStream.Message),
  //     this.initMessageStream(typeofStream.GroupUpdated),
  //     this.initConversationStream(),
  //     this.initConsentStream(),
  //   ]);
  // }

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
                `Received group updated, ${JSON.stringify(message, null, 2)}`,
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
                `Received message, ${JSON.stringify(message?.content, null, 2)}`,
              );
              // Handle auto-responses if enabled
              if (this.shouldRespondToMessage(message)) {
                await this.handleResponse(message);
                continue;
              }

              // Emit standard message
              if (this.listenerCount("worker_message") > 0) {
                this.emit("worker_message", {
                  type: StreamCollectorType.Message,
                  message,
                });
              }
            }
          }
        } catch (error) {
          console.error(
            `[${this.nameId}] Message stream error: ${String(error)}`,
          );
        }
      }
    })();
  }

  /**
   * Check if a message should trigger a response
   */
  private shouldRespondToMessage(message: DecodedMessage): boolean {
    if (this.typeOfResponse === typeOfResponse.None) return false;

    const conversation = this.client.conversations.getConversationById(
      message.conversationId,
    );
    const baseName = this.name.split("-")[0].toLowerCase();
    const isDm = conversation instanceof Dm;
    const content = (message.content as string).toLowerCase();
    //
    return (
      (message?.contentType?.typeId === "text" &&
        content.includes(baseName) &&
        !content.includes("/") &&
        !content.includes("workers") &&
        !content.includes("members") &&
        !content.includes("admins")) ||
      isDm
    );
  }

  /**
   * Handle generating and sending GPT responses
   */
  private async handleResponse(message: DecodedMessage) {
    console.time(`[${this.nameId}] Worker response`);

    try {
      // Get the conversation from the message
      const conversation = await this.client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.error(`[${this.nameId}] Conversation not found for response`);
        return;
      }

      if (this.typeOfResponse === typeOfResponse.Gpt) {
        const messages = await conversation?.messages();
        const baseName = this.name.split("-")[0].toLowerCase();

        // Generate a response using OpenAI
        const response = await generateOpenAIResponse(
          message.content as string,
          messages ?? [],
          baseName,
        );

        console.debug(`GPT response, "${response.slice(0, 50)}..."`);

        // Send the response
        await conversation?.send(response);
      } else {
        await conversation?.send(`${this.nameId} says: gm`);
      }
    } catch (error) {
      console.error(`[${this.nameId}] Error generating response:`, error);
    } finally {
      console.timeEnd(`[${this.nameId}] Worker response`);
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
            if (!this.activeStreams) break;

            console.debug(`Received conversation, ${conversation?.id}`);
            if (!conversation?.id) continue;

            if (this.listenerCount("worker_message") > 0) {
              this.emit("worker_message", {
                type: StreamCollectorType.Conversation,
                conversation,
              });
            }
          }
        } catch (error) {
          console.error(
            `[${this.nameId}] Conversation stream error: ${String(error)}`,
          );
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
                console.debug(
                  `Skipping empty consent update, ${JSON.stringify(consentUpdate, null, 2)}`,
                );
              }
            }
          }
        } catch (error) {
          console.error(
            `[${this.nameId}] Consent stream error: ${String(error)}`,
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
        console.debug(
          `Stream collection timed out. Collected ${events.length}/${count} events.`,
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
        const streamMsg = msg;
        const conversationId = streamMsg.message.conversationId;
        const contentType = streamMsg.message.contentType;
        return groupId === conversationId && contentType?.typeId === "text";
      },
      count,
      additionalInfo: { groupId },
    });
  }

  /**
   * Collect group update messages for a specific group
   */
  collectGroupUpdates(
    groupId: string,
    count: number,
  ): Promise<StreamGroupUpdateMessage[]> {
    console.debug(
      `[${this.nameId}] Starting to collect ${count} group updates for group ${groupId}`,
    );

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
        console.debug(
          `[${this.nameId}] Checking group ID: ${groupId} === ${streamMsg.group?.conversationId}`,
        );

        const matches = groupId === streamMsg.group?.conversationId;
        console.debug(`[${this.nameId}] Group ID match: ${matches}`);

        return matches;
      },
      count,
      additionalInfo: { groupId },
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
    const dataPath =
      getDataPath(this.testName) + "/" + this.name + "/" + this.folder;
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
}
