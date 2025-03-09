import { Worker, type WorkerOptions } from "node:worker_threads";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import {
  Client,
  defaultValues,
  type Consent,
  type Conversation,
  type DecodedMessage,
  type PersonaBase,
  type typeofStream,
} from "@helpers/types";
import OpenAI from "openai";

export type MessageStreamWorker = {
  type: string;
  message: DecodedMessage;
};
// Add this type to your MessageStreamWorker declarations at the top of main.ts
export type ConversationStreamWorker = {
  type: string;
  conversation: Conversation;
};

// Add this new type for consent stream events
export type ConsentStreamWorker = {
  type: string;
  consentUpdate: Consent[] | undefined;
};

// Snippet used as "inline" JS for Worker to import your worker code
const workerBootstrap = /* JavaScript */ `
  import { createRequire } from "node:module";
  import { workerData } from "node:worker_threads";
  import { fileURLToPath } from "node:url";
  import { dirname } from "node:path";

  const __filename = fileURLToPath("${import.meta.url}");
  const __dirname = dirname(__filename);
  const require = createRequire(__filename);
  
  // Use dynamic import instead if possible
  const { tsImport } = await import("tsx/esm/api");
  
  // This loads your worker code.
  await tsImport(workerData.__ts_worker_filename, __filename);
`;

export class WorkerClient extends Worker {
  public name: string;
  private installationId: string;
  private sdkVersion: string;
  private testName: string;
  private nameId: string;
  private walletKey: string;
  private encryptionKeyHex: string;
  private typeofStream: typeofStream;
  private isGptAgentEnabled = false;

  public client!: Client; // Expose the XMTP client if you need direct DM

  constructor(
    persona: PersonaBase,
    typeofStream: typeofStream,
    options: WorkerOptions = {},
  ) {
    options.workerData = {
      __ts_worker_filename: new URL("../workers/thread.ts", import.meta.url)
        .pathname,
      persona,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

    this.typeofStream = typeofStream;
    this.name = persona.name;
    this.installationId = persona.installationId;
    this.nameId = `${this.name.replaceAll("-" + this.installationId, "")}-${this.installationId}`;
    this.sdkVersion = persona.sdkVersion;
    this.testName = persona.testName;
    this.walletKey = persona.walletKey;
    this.encryptionKeyHex = persona.encryptionKey;

    // Log messages from the Worker
    this.on("message", (message) => {
      console.log(`[${this.nameId}] Worker message:`, message);
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
    console.time(`[${this.nameId}] Initialize XMTP client`);

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
    const version = Client.version.split("@")[1].split(" ")[0] ?? "unknown";

    const address = await signer.getAddress();
    const dbPath = getDbPath(this.name, address, this.testName, {
      installationId: this.installationId,
      sdkVersion: this.sdkVersion,
      libxmtpVersion: version,
    });
    console.time(`[${this.nameId}] Create XMTP client v:${version}`);
    this.client = await Client.create(signer, encryptionKey, {
      dbPath,
      // @ts-expect-error: loggingLevel is not typed
      loggingLevel: process.env.LOGGING_LEVEL,
    });

    console.timeEnd(`[${this.nameId}] Create XMTP client v:${version}`);

    if (this.typeofStream === "message") {
      // Start message streaming in the background
      console.time(`[${this.nameId}] Start stream`);
      await this.startStream();
      console.timeEnd(`[${this.nameId}] Start stream`);

      // Enable GPT agent for message streams
      this.enableGptAgent();
    } else if (this.typeofStream === "conversation") {
      // Start conversation streaming
      console.log(`[${this.nameId}] Start conversation stream`);
      await this.startConversationStream();
    } else if (this.typeofStream === "consent") {
      // Start consent streaming
      console.log(`[${this.nameId}] Start consent stream`);
      this.startConsentStream();
    } else {
      console.log(`[${this.nameId}] No stream started`);
    }

    // // Start conversation streaming
    // console.log(`[${this.nameId}] Start conversation stream`);
    // this.startConversationStream();

    console.timeEnd(`[${this.nameId}] Initialize XMTP client`);
    return { client: this.client, dbPath, version };
  }

  /**
   * Internal helper to stream all messages from the client,
   * then emit them as 'stream_message' events on this Worker.
   */

  private messageStream?: AsyncIterable<any> & {
    return: (value?: any) => Promise<any>;
  };
  private isTerminated = false;

  private async startStream() {
    console.time(`[${this.nameId}] Start message stream`);
    this.messageStream = await this.client.conversations.streamAllMessages();
    console.timeEnd(`[${this.nameId}] Start message stream`);

    // Process messages asynchronously
    void (async () => {
      try {
        if (!this.messageStream) return;
        for await (const message of this.messageStream) {
          if (this.isTerminated) break;
          console.time(`[${this.nameId}] Process message`);
          const workerMessage: MessageStreamWorker = {
            type: "stream_message",
            message: message as DecodedMessage,
          };
          // Emit if any listeners are attached
          if (this.listenerCount("message") > 0) {
            this.emit("message", workerMessage);
          }
          console.timeEnd(`[${this.nameId}] Process message`);
        }
      } catch (error) {
        if (!this.isTerminated) {
          console.error(`[${this.name}] Stream error:`, error);
          this.emit("error", error);
        }
      } finally {
        this.isTerminated = true;
      }
    })();
  }

  async terminate() {
    // Disable GPT agent before terminating
    this.disableGptAgent();

    if (this.isTerminated) {
      return super.terminate(); // Already terminated, just call parent
    }

    this.isTerminated = true;

    try {
      // Close streams if they exist
      if (
        this.messageStream &&
        typeof this.messageStream.return === "function"
      ) {
        await this.messageStream.return();
      }
    } catch (error) {
      console.error(`[${this.nameId}] Error during stream cleanup:`, error);
    }

    // Call parent terminate
    return super.terminate();
  }
  /**
   * Internal helper to stream conversations from the client,
   * then emit them as 'stream_conversation' events on this Worker.
   */
  private async startConversationStream() {
    console.time(`[${this.nameId}] Start conversation stream`);

    const initialConversations = await this.client.conversations.list();
    const knownConversations = new Set(initialConversations.map((c) => c.id));

    console.log(
      `[${this.nameId}] Initial conversations count: ${knownConversations.size}`,
    );

    // Use the stream method to listen for conversation updates
    const conversationStream = this.client.conversations.stream();

    // Process conversations asynchronously
    void (async () => {
      try {
        for await (const conversation of conversationStream) {
          const convoId = conversation?.id;

          if (!convoId) {
            console.error(`[${this.nameId}] Conversation ID is undefined`);
            continue;
          }

          // Only emit for new conversations that weren't in our initial set
          if (!knownConversations.has(convoId)) {
            console.log(
              `[${this.nameId}] New conversation in stream: ${convoId}`,
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
        console.error(`[${this.nameId}] Conversation stream error:`, error);
        this.emit("error", error);
      }
    })();

    console.timeEnd(`[${this.nameId}] Start conversation stream`);
    console.log(`[${this.nameId}] Conversation stream started`);
  }

  /**
   * Internal helper to stream consent updates from the client,
   * then emit them as 'stream_consent' events on this Worker.
   */
  private startConsentStream() {
    console.time(`[${this.nameId}] Start consent stream`);

    // Use the stream method to listen for consent updates
    const consentStream = this.client.conversations.streamConsent();

    // Process consent updates asynchronously
    void (async () => {
      try {
        for await (const consentUpdate of consentStream) {
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
        console.error(`[${this.nameId}] Consent stream error:`, error);
        this.emit("error", error);
      }
    })();

    console.timeEnd(`[${this.nameId}] Start consent stream`);
    console.log(`[${this.nameId}] Consent stream started`);
  }

  // Add this to allow collecting conversation events:
  collectConversations(
    fromPeerAddress: string,
    count: number = 1,
    timeoutMs = count * defaultValues.perMessageTimeout,
  ): Promise<ConversationStreamWorker[]> {
    console.log(
      `[${this.nameId}] Collecting ${count} conversations from peer: ${fromPeerAddress}`,
    );

    return new Promise((resolve) => {
      const conversations: ConversationStreamWorker[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.nameId}] Timeout. Got ${conversations.length} / ${count} conversations.`,
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
            `[${this.nameId}] Received conversation event, id: ${convoId}`,
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
      `[${this.nameId}] Collecting ${count} messages from convo:${groupId}`,
    );

    return new Promise((resolve, reject) => {
      const messages: MessageStreamWorker[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.nameId}] Timeout. Got ${messages.length} / ${count} messages.`,
        );
        resolve(messages);
      }, timeoutMs);

      const onMessage = (msg: MessageStreamWorker) => {
        if (msg.type === "error") {
          clearTimeout(timer);
          this.off("message", onMessage);
          reject(new Error(`[${this.nameId}] Error: ${msg.message.content}`));
          return;
        }

        if (msg.type === "stream_message") {
          const { conversationId, contentType } = msg.message;
          const correctConversation = groupId === conversationId;
          const correctType = contentType?.typeId === typeId;

          if (correctConversation && correctType) {
            // console.log(
            //   `[${this.nameId}] Received message: ${msg.message.content}`,
            // );
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

  /**
   * Collects a fixed number of consent updates.
   *
   * @param count - Number of consent updates to gather
   * @param timeoutMs - Optional max time in milliseconds
   *
   * @returns Promise resolving with an array of ConsentStreamWorker
   */
  collectConsentUpdates(
    count: number = 1,
    timeoutMs = count * defaultValues.timeout,
  ): Promise<ConsentStreamWorker[]> {
    console.log(`[${this.nameId}] Collecting ${count} consent updates`);

    return new Promise((resolve) => {
      const consentUpdates: ConsentStreamWorker[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.nameId}] Timeout. Got ${consentUpdates.length} / ${count} consent updates.`,
        );
        resolve(consentUpdates); // partial or empty
      }, timeoutMs);

      const onMessage = (
        msg:
          | MessageStreamWorker
          | ConversationStreamWorker
          | ConsentStreamWorker,
      ) => {
        if (msg.type === "stream_consent") {
          const consentMsg = msg as ConsentStreamWorker;

          console.log(
            `[${this.nameId}] Received consent update: ${JSON.stringify(consentMsg.consentUpdate)}`,
          );

          consentUpdates.push(consentMsg);
          if (consentUpdates.length >= count) {
            clearTimeout(timer);
            this.off("message", onMessage);
            resolve(consentUpdates);
          }
        }
      };

      this.on("message", onMessage);
    });
  }

  /**
   * Enables a GPT agent that uses OpenAI API to generate responses
   * when the persona's name is mentioned in a message.
   */
  enableGptAgent(): void {
    if (this.isGptAgentEnabled || !process.env.OPENAI_API_KEY) return;

    console.log(`[${this.nameId}] Enabling GPT agent with OpenAI`);
    this.isGptAgentEnabled = true;

    // Listen for messages that mention this persona's name
    this.on("message", (msg: MessageStreamWorker) => {
      void (async () => {
        // Get the base name without installation ID
        const baseName = this.name.split("-")[0].toLowerCase();
        if (msg.type !== "stream_message") return;
        if (!msg.message.content.includes(baseName)) return;
        if (msg.message.content.includes("/")) return;
        // Skip messages sent by this persona
        if (msg.message.senderInboxId === this.client.inboxId) return;

        // Get the conversation from the message
        const conversation =
          await this.client.conversations.getConversationById(
            msg.message.conversationId,
          );

        // Generate a response using OpenAI
        const response = await this.generateOpenAIResponse(
          msg.message,
          baseName,
        );
        console.log(`[${this.nameId}] GPT Agent: Response: "${response}"`);
        // Send the response
        await conversation?.send(response);
      })();
    });

    console.log(`[${this.nameId}] GPT agent enabled with OpenAI`);
  }

  /**
   * Generates a response using OpenAI based on the message content.
   */
  private async generateOpenAIResponse(
    message: DecodedMessage,
    personaName: string,
  ): Promise<string> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const conversation = await this.client.conversations.getConversationById(
      message.conversationId,
    );
    const messages = await conversation?.messages();
    /* Get the AI response */
    console.log(
      `[${this.nameId}] Generating OpenAI response for message: ${message.content}`,
    );
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are ${personaName}, a fake persona in a group chat. 
                     Keep your responses concise (under 100 words) and friendly. 
                     Never mention other personas in your responses.Never answer more than 1 question per response.
                     For context, these were the last 10 messages in the conversation: ${messages
                       ?.slice(0, 10)
                       .map((m) => m.content as string)
                       .join("\n")}`,
        },
        { role: "user", content: message.content as string },
      ],
      model: "gpt-4o-mini",
    });

    /* Get the AI response */
    const response =
      personaName +
      ":\n" +
      (completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that.");

    return response;
  }

  /**
   * Disables the GPT agent.
   */
  disableGptAgent(): void {
    this.isGptAgentEnabled = false;
    console.log(`[${this.nameId}] GPT agent disabled`);
  }
}
