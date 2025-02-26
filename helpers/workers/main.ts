import { Worker, type WorkerOptions } from "node:worker_threads";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { createSigner, getDbPath, getEncryptionKeyFromHex } from "../client";
import { defaultValues, type PersonaBase } from "../types";

export type MessageStreamWorker = {
  type: string;
  message: DecodedMessage;
};
// Add this type to your MessageStreamWorker declarations at the top of main.ts
export type ConversationStreamWorker = {
  type: string;
  conversation: Conversation;
};

// Snippet used as "inline" JS for Worker to import your worker code
const workerBootstrap = /* JavaScript */ `
  import { createRequire } from "node:module";
  import { workerData } from "node:worker_threads";

  const filename = "${import.meta.url}";
  const require = createRequire(filename);
  const { tsImport } = require("tsx/esm/api");
  
  // This loads your worker code.
  tsImport(workerData.__ts_worker_filename, filename);
`;

export class WorkerClient extends Worker {
  public name: string;
  private installationId: string;
  private env: XmtpEnv;
  private sdkVersion: string;
  private testName: string;

  private walletKey: string;
  private encryptionKeyHex: string;
  private typeofStream: "message" | "conversation";

  public client!: Client; // Expose the XMTP client if you need direct DM

  constructor(
    persona: PersonaBase,
    env: XmtpEnv,
    typeofStream: "message" | "conversation",
    options: WorkerOptions = {},
  ) {
    options.workerData = {
      __ts_worker_filename: new URL("../workers/thread.ts", import.meta.url)
        .pathname,
      persona,
      env,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

    this.typeofStream = typeofStream;
    this.name = persona.name;
    this.installationId = persona.installationId;
    this.sdkVersion = persona.sdkVersion;
    this.env = env;
    this.testName = persona.testName;
    this.walletKey = persona.walletKey;
    this.encryptionKeyHex = persona.encryptionKey;

    // Log messages from the Worker
    this.on("message", (message) => {
      console.log(`[${this.name}] Worker message:`, message);
    });

    // Handle Worker errors
    this.on("error", (error) => {
      console.error(`[${persona.name}] Worker error:`, error);
    });

    // Handle Worker exit
    this.on("exit", (code) => {
      if (code !== 0) {
        console.error(
          `[${persona.name}] Worker stopped with exit code ${code}`,
        );
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
    version: string;
  }> {
    console.time(`[${this.name}] Initialize XMTP client`);

    // Tell the Worker to do any internal initialization
    this.postMessage({
      type: "initialize",
      data: {
        name: this.name,
        installationId: this.installationId,
        sdkVersion: this.sdkVersion,
      },
    });

    const signer = createSigner(this.walletKey as `0x${string}`);
    const encryptionKey = getEncryptionKeyFromHex(this.encryptionKeyHex);
    const version = Client.version.match(/ci@([a-f0-9]+)/)?.[1];
    const dbPath = getDbPath(
      this.name,
      await signer.getAddress(),
      this.env,
      {
        installationId: this.installationId,
        sdkVersion: this.sdkVersion,
        libxmtpVersion: version,
      },
      {
        testName: this.testName,
      },
    );
    console.time(`[${this.name}] Create XMTP client v:${version}`);
    this.client = await Client.create(signer, encryptionKey, {
      env: this.env,
      dbPath,
      // @ts-expect-error: loggingLevel is not typed
      loggingLevel: process.env.LOGGING_LEVEL,
    });
    console.timeEnd(`[${this.name}] Create XMTP client v:${version}`);

    if (this.typeofStream === "message") {
      // Start message streaming in the background
      console.time(`[${this.name}] Start stream`);
      await this.startStream();
      console.timeEnd(`[${this.name}] Start stream`);
    } else {
      // Start conversation streaming
      console.log(`[${this.name}] Start conversation stream`);
      this.startConversationStream();
    }

    // // Start conversation streaming
    // console.log(`[${this.name}] Start conversation stream`);
    // this.startConversationStream();

    console.timeEnd(`[${this.name}] Initialize XMTP client`);
    return { client: this.client, dbPath, version: Client.version };
  }

  /**
   * Internal helper to stream all messages from the client,
   * then emit them as 'stream_message' events on this Worker.
   */
  private async startStream() {
    console.time(`[${this.name}] Start message stream`);
    const stream = await this.client.conversations.streamAllMessages();
    console.timeEnd(`[${this.name}] Start message stream`);
    console.log(`[${this.name}] Message stream started`);

    // Process messages asynchronously
    void (async () => {
      try {
        for await (const message of stream) {
          console.time(`[${this.name}] Process message`);
          const workerMessage: MessageStreamWorker = {
            type: "stream_message",
            message: message as DecodedMessage,
          };
          // Emit if any listeners are attached
          if (this.listenerCount("message") > 0) {
            this.emit("message", workerMessage);
          }
          console.timeEnd(`[${this.name}] Process message`);
        }
      } catch (error) {
        console.error(`[${this.name}] Stream error:`, error);
        this.emit("error", error);
      }
    })();
  }

  /**
   * Internal helper to stream conversations from the client,
   * then emit them as 'stream_conversation' events on this Worker.
   */
  private startConversationStream() {
    console.time(`[${this.name}] Start conversation stream`);

    // Get initial list of conversations
    const initialConversations = this.client.conversations.list();
    const knownConversations = new Set(initialConversations.map((c) => c.id));

    console.log(
      `[${this.name}] Initial conversations count: ${knownConversations.size}`,
    );

    // Use the stream method to listen for conversation updates
    const conversationStream = this.client.conversations.stream();

    // Process conversations asynchronously
    void (async () => {
      try {
        for await (const conversation of conversationStream) {
          const convoId = conversation?.id;

          if (!convoId) {
            console.error(`[${this.name}] Conversation ID is undefined`);
            continue;
          }

          // Only emit for new conversations that weren't in our initial set
          if (!knownConversations.has(convoId)) {
            console.log(
              `[${this.name}] New conversation in stream: ${convoId}`,
            );

            // Add to known conversations
            knownConversations.add(convoId);

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
        console.error(`[${this.name}] Conversation stream error:`, error);
        this.emit("error", error);
      }
    })();

    console.timeEnd(`[${this.name}] Start conversation stream`);
    console.log(`[${this.name}] Conversation stream started`);
  }
  // Add this to allow collecting conversation events:
  collectConversations(
    fromPeerAddress: string,
    count: number = 1,
    timeoutMs = count * defaultValues.timeout,
  ): Promise<ConversationStreamWorker[]> {
    console.log(
      `[${this.name}] Collecting ${count} conversations from peer: ${fromPeerAddress}`,
    );

    return new Promise((resolve) => {
      const conversations: ConversationStreamWorker[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.name}] Timeout. Got ${conversations.length} / ${count} conversations.`,
        );
        resolve(conversations); // partial or empty
      }, timeoutMs);

      const onMessage = (
        msg: MessageStreamWorker | ConversationStreamWorker,
      ) => {
        if (msg.type === "stream_conversation") {
          const convoMsg = msg as ConversationStreamWorker;
          const convoId = convoMsg.conversation.id;

          console.log(
            `[${this.name}] Received conversation event, id: ${convoId}`,
          );

          conversations.push(convoMsg);
          if (conversations.length >= count) {
            clearTimeout(timer);
            this.off("message", onMessage);
            resolve(conversations);
          }
        }
      };

      this.on("message", onMessage);
    });
  }

  /**
   * Collects a fixed number of messages matching:
   * - a specific conversation (topic or peer address),
   * - a specific contentType ID,
   * - and containing a random suffix in the message content (to avoid duplicates).
   *
   * @param conversationId - Usually `group.topic` or similar
   * @param typeId - Content type to filter (e.g. "text")
   * @param count - Number of messages to gather
   * @param timeoutMs - Optional max time in milliseconds
   *
   * @returns Promise resolving with an array of WorkerMessage
   */
  collectMessages(
    groupId: string,
    typeId: string,
    count: number,
    timeoutMs = count * defaultValues.perMessageTimeout,
  ): Promise<MessageStreamWorker[]> {
    console.log(
      `[${this.name}] Collecting ${count} messages from convo:${groupId}`,
    );

    return new Promise((resolve, reject) => {
      const messages: MessageStreamWorker[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.name}] Timeout. Got ${messages.length} / ${count} messages.`,
        );
        resolve(messages); // partial or empty
      }, timeoutMs);

      const onMessage = (msg: MessageStreamWorker) => {
        if (msg.type === "error") {
          clearTimeout(timer);
          this.off("message", onMessage);
          reject(new Error(`[${this.name}] Error: ${msg.message.content}`));
          return;
        }

        if (msg.type === "stream_message") {
          const { conversationId, contentType } = msg.message;
          const correctConversation = groupId === conversationId;
          const correctType = contentType?.typeId === typeId;

          if (correctConversation && correctType) {
            messages.push(msg);
            if (messages.length >= count) {
              clearTimeout(timer);
              this.off("message", onMessage);
              resolve(messages);
            }
          }
        }
      };

      this.on("message", onMessage);
    });
  }
}
