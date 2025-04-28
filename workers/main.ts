import fs from "node:fs";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { createClient, getDataPath } from "@helpers/client";
import { personalities } from "@helpers/tests";
import {
  Dm,
  type Client,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import OpenAI from "openai";
import type { typeOfResponse, typeofStream, WorkerBase } from "./manager";

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
  private initMessageStream() {
    void (async () => {
      while (true) {
        try {
          await this.client.conversations.sync();
          const stream = await this.client.conversations.streamAllMessages();

          for await (const message of stream) {
            if (
              !message ||
              message?.senderInboxId.toLowerCase() ===
                this.client.inboxId.toLowerCase()
            ) {
              continue;
            }

            // console.log(
            //   message?.contentType?.typeId,
            //   JSON.stringify(message.content),
            // );
            // Check if this is a group update message
            if (message?.contentType?.typeId === "group_updated") {
              if (this.listenerCount("message") > 0) {
                this.emit("message", {
                  type: "stream_group_updated",
                  group: message,
                });
              }
              continue;
            }

            // Handle auto-responses if enabled
            if (this.shouldRespondToMessage(message)) {
              await this.handleResponse(message);
              continue;
            }

            // Emit standard message
            if (this.listenerCount("message") > 0) {
              this.emit("message", { type: "stream_message", message });
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
    })();
  }

  /**
   * Check if a message should trigger a response
   */
  private shouldRespondToMessage(message: DecodedMessage): boolean {
    if (this.typeOfResponse === "none") return false;

    const conversation = this.client.conversations.getConversationById(
      message.conversationId,
    );
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

      if (!conversation) {
        console.error(`[${this.nameId}] Conversation not found for response`);
        return;
      }

      if (this.typeOfResponse === "gpt") {
        const messages = await conversation?.messages();
        const baseName = this.name.split("-")[0].toLowerCase();

        // Generate a response using OpenAI
        const response = await this.generateOpenAIResponse(
          message.content as string,
          messages ?? [],
          baseName,
        );

        console.log(
          `[${this.nameId}] GPT response: "${response.slice(0, 50)}..."`,
        );

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
    void (async () => {
      while (true) {
        try {
          await this.client.conversations.sync();
          const stream = await this.client.conversations.stream();

          for await (const conversation of stream) {
            if (!conversation?.id) continue;

            if (this.listenerCount("message") > 0) {
              this.emit("message", {
                type: "stream_conversation",
                conversation,
              });
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
    })();
  }

  /**
   * Initialize consent stream
   */
  private initConsentStream() {
    void (async () => {
      while (true) {
        try {
          await this.client.conversations.sync();
          const stream = await this.client.preferences.streamConsent();

          for await (const consentUpdate of stream) {
            if (this.listenerCount("message") > 0) {
              this.emit("message", {
                type: "stream_consent",
                consentUpdate,
              });
            }
          }
        } catch (error) {
          console.debug(error);
        }
      }
    })();
  }

  /**
   * Collects stream events of specified type
   */
  collectStreamEvents<T>(options: {
    type: "message" | "conversation" | "consent" | "group_updated";
    filterFn?: (msg: any) => boolean;
    count: number;
    additionalInfo?: Record<string, any>;
  }): Promise<T[]> {
    const { type, filterFn, count, additionalInfo = {} } = options;
    const filterInfo = Object.entries(additionalInfo)
      .map(([key, value]) => `${key}:${value}`)
      .join(", ");

    console.log(
      `[${this.nameId}] Collecting ${count} ${type}${filterInfo ? ` (${filterInfo})` : ""}`,
    );

    return new Promise((resolve) => {
      const events: T[] = [];
      const onMessage = (msg: any) => {
        const isRightType = msg.type === `stream_${type}`;
        const passesFilter = !filterFn || filterFn(msg);

        if (isRightType && passesFilter) {
          events.push(msg as T);
          if (events.length >= count) {
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
  ): Promise<any[]> {
    return this.collectStreamEvents<any>({
      type: "message",
      filterFn: (msg) => {
        if (msg.type !== "stream_message") return false;
        const { conversationId, contentType } = msg.message;
        return groupId === conversationId && contentType?.typeId === typeId;
      },
      count,
      additionalInfo: { groupId, contentType: typeId },
    });
  }

  /**
   * Collect group update messages for a specific group
   */
  collectGroupUpdates(groupId: string, count: number): Promise<any[]> {
    return this.collectStreamEvents<any>({
      type: "group_updated",
      filterFn: (msg) => {
        if (msg.type !== "stream_group_updated") return false;
        return groupId === msg.group.conversationId;
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
  ): Promise<any[]> {
    return this.collectStreamEvents<any>({
      type: "conversation",
      count,
      additionalInfo: { fromPeerAddress },
    });
  }

  /**
   * Collect consent updates
   */
  collectConsentUpdates(count: number = 1): Promise<any[]> {
    return this.collectStreamEvents<any>({
      type: "consent",
      count,
    });
  }

  /**
   * Generates a response using OpenAI based on the message content.
   */
  private async generateOpenAIResponse(
    message: string,
    history: DecodedMessage[],
    workerName: string,
  ): Promise<string> {
    // First check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set in environment variables. GPT workers may not function properly.",
      );
      return `${workerName}: Sorry, I'm not able to generate a response right now.`;
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log(
      `[${this.nameId}] Generating OpenAI response for message: ${message}`,
    );

    // Find matching personality or use a default
    const personality =
      personalities.find((p) => p.name === workerName)?.personality ||
      "You are a helpful assistant with a friendly personality.";

    // Prepare recent message history
    const recentHistory =
      history
        ?.slice(-10)
        .map((m) => m.content as string)
        .join("\n") || "";

    const systemPrompt = `You are ${workerName}.
                     Keep your responses concise (under 100 words) and friendly. 
                     Never mention other workers in your responses. Never answer more than 1 question per response.

                     Personality: 
                     ${personality}
                     
                     For context, these were the last messages in the conversation: 
                     ${recentHistory}`;

    try {
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

      return `${workerName}:\n${
        completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that."
      }`;
    } catch (error) {
      console.error(`[${this.nameId}] OpenAI API error:`, error);
      return `${workerName}: Sorry, I couldn't process that request right now.`;
    }
  }

  /**
   * Clears the database for this worker
   * @returns true if the database was cleared, false otherwise
   */
  clearDB(): Promise<boolean> {
    const dataPath =
      getDataPath(this.testName) + "/" + this.name + "/" + this.folder;
    console.log(`[${this.nameId}] Clearing database at ${dataPath}`);

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
