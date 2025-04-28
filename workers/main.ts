import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { createClient, getDataPath } from "@helpers/client";
import { defaultValues } from "@helpers/tests";
import {
  Dm,
  type Client,
  type Consent,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import OpenAI from "openai";
import type { typeOfResponse, typeofStream, WorkerBase } from "./manager";

// Unified worker message types
export type WorkerMessageBase = {
  type: string;
};

export type MessageStreamWorker = WorkerMessageBase & {
  type: "stream_message";
  message: DecodedMessage;
};

export type ConversationStreamWorker = WorkerMessageBase & {
  type: "stream_conversation";
  conversation: Conversation;
};

export type ConsentStreamWorker = WorkerMessageBase & {
  type: "stream_consent";
  consentUpdate: Consent[] | undefined;
};

export type WorkerMessage =
  | MessageStreamWorker
  | ConversationStreamWorker
  | ConsentStreamWorker;

// Worker thread code as a string
const workerThreadCode = `
import { parentPort, workerData } from "node:worker_threads";
import type { Client } from "@xmtp/node-sdk";

// The Worker must be run in a worker thread, so confirm \`parentPort\` is defined
if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

// Optional logs to see what's being passed into the worker.
console.log("[Worker] Started with workerData:", workerData);

// Listen for messages from the parent
parentPort.on("message", (message: { type: string; data: any }) => {
  switch (message.type) {
    case "initialize":
      // You can add logs or do any one-time setup here.
      console.log("[Worker] Received 'initialize' message:", message.data);
      break;

    default:
      console.log(\`[Worker] Received unknown message type: \${message.type}\`);
      break;
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught Exception:", error);
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
  // Stream management
  private activeStream?: AsyncIterable<any> & {
    return: (value?: any) => Promise<any>;
  };
  private isTerminated = false;

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

  /**
   * Reinstalls the worker
   */
  public async reinstall(): Promise<void> {
    console.log(`[${this.nameId}] Reinstalling worker`);
    await this.terminate();
    await this.clearDB();
    await this.initialize();
  }

  private setupEventHandlers() {
    // Log messages from the Worker
    this.on("message", (message) => {
      console.log(`[${this.nameId}] Worker message:`, message);
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
  /**
   * Unified method to start the appropriate stream based on configuration
   */
  private startStream() {
    try {
      switch (this.typeofStream) {
        case "message":
          this.initMessageStream();
          break;
        case "conversation":
          this.initConversationStream();
          break;
        case "consent":
          this.initConsentStream();
          break;
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
   * Initialize and handle message stream
   */
  private initMessageStream() {
    // Process messages asynchronously
    void (async () => {
      // Start stream in an infinite loop to handle restarts
      while (true) {
        try {
          console.log("Starting message stream...");
          console.log("✓ Syncing conversations...");
          await this.client.conversations.sync();
          const streamPromise = this.client.conversations.streamAllMessages();
          const stream = await streamPromise;

          for await (const message of stream) {
            if (this.isTerminated) break;
            // Skip messages from self
            if (
              message?.senderInboxId?.toLowerCase() ===
                this.client.inboxId.toLowerCase() ||
              message?.contentType?.typeId !== "text"
            ) {
              continue;
            }

            if (message && this.shouldRespondToMessage(message)) {
              await this.handleResponse(message);
              continue;
            }

            // Create worker message
            const workerMessage: MessageStreamWorker = {
              type: "stream_message",
              message: message,
            };

            // Emit if any listeners are attached
            if (this.listenerCount("message") > 0) {
              this.emit("message", workerMessage);
            }
          }
        } catch (error) {
          console.debug(error);
        }
      }
    })();
  }

  /**
   * Check if a message should trigger a GPT response
   */
  private shouldRespondToMessage(message: DecodedMessage): boolean {
    if (this.typeOfResponse === "none") return false;
    const conversation = this.client.conversations.getConversationById(
      message.conversationId,
    );
    // Get the base name without installation ID
    const baseName = this.name.split("-")[0].toLowerCase();
    const isDm = conversation instanceof Dm;
    const content = message.content as string;
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

      if (this.typeOfResponse === "gpt") {
        const messages = await conversation?.messages();
        const baseName = this.name.split("-")[0].toLowerCase();
        // Generate a response using OpenAI
        const response = await this.generateOpenAIResponse(
          message.content as string,
          messages ?? [],
          baseName,
        );

        console.log(`[${this.nameId}] GPT Agent: Response: "${response}"`);

        // Send the response
        await conversation?.send(response);
      } else {
        await conversation?.send(this.nameId + " says: gm");
      }
    } catch (error) {
      console.error(
        `[${this.nameId}] Error generating stream response:`,
        error,
      );
    } finally {
      console.timeEnd(`[${this.nameId}] Worker response`);
    }
  }

  /**
   * Initialize and handle conversation stream
   */
  private initConversationStream() {
    // Process conversations asynchronously
    void (async () => {
      // Track initial conversations to avoid duplicates
      const initialConversations = await this.client.conversations.list();
      const knownConversations = new Set(initialConversations.map((c) => c.id));

      console.log(
        `[${this.nameId}] Initial conversations count: ${knownConversations.size}`,
      );

      // Use the stream method to listen for conversation updates
      this.activeStream = this.client.conversations.stream();

      try {
        if (!this.activeStream) return;

        for await (const conversation of this.activeStream) {
          if (this.isTerminated) break;

          const convoId = conversation?.id;

          if (!convoId) {
            console.error(`[${this.nameId}] Conversation ID is undefined`);
            continue;
          }

          // Only emit for new conversations that weren't in our initial set
          if (!knownConversations.has(convoId as string)) {
            console.log(
              `[${this.nameId}] New conversation in stream: ${convoId}`,
            );

            // Add to known conversations
            knownConversations.add(convoId as string);

            // Create and emit the worker message
            const workerMessage: ConversationStreamWorker = {
              type: "stream_conversation",
              conversation: conversation,
            };

            // Emit if any listeners are attached
            if (this.listenerCount("message") > 0) {
              this.emit("message", workerMessage);
            }
          }
        }
      } catch (error) {
        if (!this.isTerminated) {
          console.error(`[${this.nameId}] Conversation stream error:`, error);
          this.emit("error", error);
        }
      }
    })();
  }

  /**
   * Initialize and handle consent stream
   */
  private initConsentStream() {
    // Use the stream method to listen for consent updates
    this.activeStream = this.client.preferences.streamConsent();

    // Process consent updates asynchronously
    void (async () => {
      try {
        if (!this.activeStream) return;

        for await (const consentUpdate of this.activeStream) {
          if (this.isTerminated) break;

          // Create and emit the worker message
          const workerMessage: ConsentStreamWorker = {
            type: "stream_consent",
            consentUpdate: consentUpdate,
          };

          // Emit if any listeners are attached
          if (this.listenerCount("message") > 0) {
            this.emit("message", workerMessage);
          }
        }
      } catch (error) {
        if (!this.isTerminated) {
          console.error(`[${this.nameId}] Consent stream error:`, error);
          this.emit("error", error);
        }
      }
    })();
  }

  /**
   * Unified method to collect stream events
   * @param options Configuration for collection
   * @returns Promise resolving with an array of WorkerMessage
   */
  collectStreamEvents<T extends WorkerMessage>(options: {
    type: "message" | "conversation" | "consent";
    filterFn?: (msg: WorkerMessage) => boolean;
    count: number;
    timeoutMs?: number;
    additionalInfo?: Record<string, any>;
  }): Promise<T[]> {
    const {
      type,
      filterFn,
      count,
      timeoutMs = count * defaultValues.perMessageTimeout,
      additionalInfo = {},
    } = options;

    const typeLabel =
      type === "message"
        ? "messages"
        : type === "conversation"
          ? "conversations"
          : "consent updates";

    const filterInfo = Object.entries(additionalInfo)
      .map(([key, value]) => `${key}:${value}`)
      .join(", ");

    console.log(
      `[${this.nameId}] Collecting ${count} ${typeLabel}${filterInfo ? ` (${filterInfo})` : ""}`,
    );

    return new Promise((resolve) => {
      const events: T[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.nameId}] Timeout. Got ${events.length} / ${count} ${typeLabel}.`,
        );
        resolve(events); // partial or empty
      }, timeoutMs);

      const onMessage = (msg: WorkerMessage) => {
        // Check if this is the right type of message
        const isRightType = msg.type === `stream_${type}`;

        // Apply additional filter if provided
        const passesFilter = !filterFn || filterFn(msg);

        if (isRightType && passesFilter) {
          let logContent = "";
          if (type === "message") {
            logContent = (msg as MessageStreamWorker).message.content as string;
          } else if (type === "conversation") {
            logContent = (msg as ConversationStreamWorker).conversation.id;
          } else {
            logContent = JSON.stringify(
              (msg as ConsentStreamWorker).consentUpdate,
            );
          }

          if (!this.testName.includes("ts")) {
            console.log(`[${this.nameId}] Received ${type}: ${logContent}`);
          }

          events.push(msg as T);
          if (events.length >= count) {
            clearTimeout(timer);
            this.off("message", onMessage);
            resolve(events);
          }
        }
      };

      this.on("message", onMessage);
    });
  }

  /**
   * Collect messages with specific criteria
   */
  collectMessages(
    groupId: string,
    typeId: string,
    count: number,
    timeoutMs = count * defaultValues.perMessageTimeout,
  ): Promise<MessageStreamWorker[]> {
    // Create an async function and immediately invoke it
    const collectMessagesAsync = async (): Promise<MessageStreamWorker[]> => {
      try {
        // Sync conversations to make sure we have the latest data
        await this.client.conversations.sync();

        // Verify the conversation exists in our client
        const conversation =
          await this.client.conversations.getConversationById(groupId);
        if (!conversation) {
          console.warn(
            `[${this.nameId}] Cannot collect messages: Group ${groupId} not found`,
          );
        } else {
          console.log(
            `[${this.nameId}] Group ${groupId} found, collecting messages...`,
          );
        }

        // Collect messages with appropriate filtering
        return await this.collectStreamEvents<MessageStreamWorker>({
          type: "message",
          filterFn: (msg) => {
            if (msg.type !== "stream_message") return false;
            const messageMsg = msg;
            const { conversationId, contentType } = messageMsg.message;
            return groupId === conversationId && contentType?.typeId === typeId;
          },
          count,
          timeoutMs,
          additionalInfo: { groupId, contentType: typeId },
        });
      } catch (error) {
        console.error(`[${this.nameId}] Error in collectMessages:`, error);
        return [];
      }
    };

    return collectMessagesAsync();
  }

  /**
   * Collect conversations
   */
  collectConversations(
    fromPeerAddress: string,
    count: number = 1,
    timeoutMs = count * defaultValues.perMessageTimeout,
  ): Promise<ConversationStreamWorker[]> {
    return this.collectStreamEvents<ConversationStreamWorker>({
      type: "conversation",
      count,
      timeoutMs,
      additionalInfo: { fromPeerAddress },
    });
  }

  /**
   * Collect consent updates
   */
  collectConsentUpdates(
    count: number = 1,
    timeoutMs = count * defaultValues.timeout,
  ): Promise<ConsentStreamWorker[]> {
    return this.collectStreamEvents<ConsentStreamWorker>({
      type: "consent",
      count,
      timeoutMs,
    });
  }

  /**
   * Clean up resources on termination
   */
  async terminate() {
    if (this.isTerminated) {
      return super.terminate(); // Already terminated, just call parent
    }

    console.time(`[${this.nameId}] Terminate stream`);
    try {
      if (this.activeStream && typeof this.activeStream.return === "function") {
        await this.activeStream.return();
        this.isTerminated = true;
        //console.warn(`[${this.nameId}] Terminated stream`);
      }
    } catch (error) {
      console.error(`[${this.nameId}] Error during stream cleanup:`, error);
    }
    console.timeEnd(`[${this.nameId}] Terminate stream`);

    // Call parent terminate
    return super.terminate();
  }

  /**
   * Generates a response using OpenAI based on the message content.
   */
  private async generateOpenAIResponse(
    message: string,
    history: DecodedMessage[],
    workerName: string,
  ): Promise<string> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log(
      `[${this.nameId}] Generating OpenAI response for message: ${message}`,
    );
    const personalities = [
      {
        name: "sam",
        personality: "Sam personally hates GPT and AI. Its kind of a jerk.",
      },
      {
        name: "walt",
        personality: "Walt is a bit more friendly. He likes to make jokes.",
      },
      {
        name: "tina",
        personality:
          "Tina its non-tech savvy. She doesn't know much about anything.",
      },
    ];

    const systemPrompt = `You are ${workerName},
                     Keep your responses concise (under 100 words) and friendly. 
                     Never mention other workers in your responses. Never answer more than 1 question per response.

                     Personality: 
                     ${
                       personalities.find((p) => p.name === workerName)
                         ?.personality
                     }
                     
                     For context, these were the last 10 messages in the conversation: ${history
                       ?.slice(0, 10)
                       .map((m) => m.content as string)
                       .join("\n")}`;

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: message },
      ],
      model: "gpt-4.1-mini",
    });
    //console.log(systemPrompt, completion.choices[0]?.message?.content);
    return (
      workerName +
      ":\n" +
      (completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that.")
    );
  }

  /**
   * Clears the database for this worker
   * @returns true if the database was cleared, false otherwise
   */
  clearDB(): Promise<boolean> {
    const dataPath =
      getDataPath(this.testName) + "/" + this.name + "/" + this.folder;
    console.log(`[${this.nameId}] Clearing database at ${dataPath}`);
    if (fs.existsSync(dataPath)) {
      fs.rmSync(dataPath, { recursive: true, force: true });
    }
    return Promise.resolve(true);
  }
}
