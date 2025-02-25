import { Worker, type WorkerOptions } from "node:worker_threads";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createSigner, getDbPath, getEncryptionKeyFromHex } from "../client";
import {
  defaultValues,
  type Conversation,
  type Persona,
  type PersonaBase,
  type VerifyStreamResult,
  type WorkerMessage,
} from "../types";

dotenv.config();

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

  public client!: Client; // Expose the XMTP client if you need direct DM

  constructor(persona: PersonaBase, env: XmtpEnv, options: WorkerOptions = {}) {
    options.workerData = {
      __ts_worker_filename: new URL("../workers/thread.ts", import.meta.url)
        .pathname,
      persona,
      env,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

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
        version: version,
      },
      {
        testName: this.testName,
      },
    );
    console.log("dbPath", dbPath);
    console.time(`[${this.name}] Create XMTP client v:${version}`);
    this.client = await Client.create(signer, encryptionKey, {
      env: this.env,
      dbPath,
      // @ts-expect-error: loggingLevel is not typed
      loggingLevel: process.env.LOGGING_LEVEL,
    });
    console.timeEnd(`[${this.name}] Create XMTP client v:${version}`);

    // Start streaming in the background
    console.time(`[${this.name}] Start stream`);
    await this.startStream();
    console.timeEnd(`[${this.name}] Start stream`);

    // Sync conversations
    console.time(`[${this.name}] Sync conversations`);
    await this.client.conversations.sync();
    console.timeEnd(`[${this.name}] Sync conversations`);

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
          const workerMessage: WorkerMessage = {
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
   * Collects a fixed number of messages matching:
   * - a specific conversation (topic or peer address),
   * - a specific contentType ID,
   * - and containing a random suffix in the message content (to avoid duplicates).
   *
   * @param conversationId - Usually `group.topic` or similar
   * @param typeId - Content type to filter (e.g. "text")
   * @param suffix - Unique substring used in messages
   * @param count - Number of messages to gather
   * @param timeoutMs - Optional max time in milliseconds
   *
   * @returns Promise resolving with an array of WorkerMessage
   */
  collectMessages(
    groupId: string,
    typeId: string,
    suffix: string,
    count: number,
    timeoutMs = count * defaultValues.perMessageTimeout,
  ): Promise<WorkerMessage[]> {
    console.log(
      `[${this.name}] Collecting ${count} '${typeId}' messages containing '${suffix}' from convo '${groupId}'`,
    );

    return new Promise((resolve, reject) => {
      const messages: WorkerMessage[] = [];
      const timer = setTimeout(() => {
        this.off("message", onMessage);
        console.warn(
          `[${this.name}] Timeout. Got ${messages.length} / ${count} messages.`,
        );
        resolve(messages); // partial or empty
      }, timeoutMs);

      const onMessage = (msg: WorkerMessage) => {
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

/**
 * Simplified `verifyStream` that sends messages to a conversation,
 * and ensures each participant collects exactly `count` messages.
 *
 * @param group Conversation (e.g. a group conversation)
 * @param participants Array of Persona objects
 * @param messageGenerator A function that produces the content (including a suffix)
 * @param sender Function to send messages to the conversation
 * @param collectorType The contentType ID to match in collecting
 * @param count Number of messages to send
 */
export async function verifyStream<T extends string>(
  group: Conversation,
  participants: Persona[],
  messageGenerator: (index: number, suffix: string) => Promise<T>,
  sender: (group: Conversation, payload: T) => Promise<void>,
  collectorType = "text",
  count = 1,
): Promise<VerifyStreamResult> {
  // Exclude the group creator from receiving
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter(
    (p) => p.client?.inboxId !== creatorInboxId,
  );

  // Conversation ID (topic or peerAddress)
  // Modify as needed depending on how you store the ID
  const conversationId = group.id;

  // Wait to ensure they are listening
  await new Promise((res) => setTimeout(res, 1000));

  // Unique random suffix to avoid counting old messages
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  // Start collectors
  const collectPromises = receivers.map((r) =>
    r.worker
      ?.collectMessages(conversationId, collectorType, randomSuffix, count)
      .then((msgs: WorkerMessage[]) => msgs.map((m) => m.message.content as T)),
  );
  // Send the messages
  for (let i = 0; i < count; i++) {
    const payload = await messageGenerator(i, randomSuffix);
    console.log(`Sending message #${i + 1}:`, payload);
    await sender(group, payload);
  }

  // Wait for collectors
  const collectedMessages = await Promise.all(collectPromises);
  const allReceived = collectedMessages.every((msgs) => msgs?.length === count);
  if (!allReceived) {
    console.error(
      "Not all participants received the expected number of messages.",
    );
  } else {
    console.log("All participants received the expected number of messages.");
  }

  return {
    allReceived,
    messages: collectedMessages.map((m) => m ?? []),
  };
}
