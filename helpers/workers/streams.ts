import { Worker, type WorkerOptions } from "node:worker_threads";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createSigner, getDbPath, getEncryptionKeyFromHex } from "../client";
import type { PersonaBase, WorkerMessage } from "../types";

dotenv.config();

// This snippet is used as the "inline" JS for your Worker to import your worker code:
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
  private libxmtpVersion: string;

  private walletKey!: string;
  private encryptionKeyHex!: string;

  public client!: Client; // Expose the XMTP client if you need direct DM send

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
    this.libxmtpVersion = persona.libxmtpVersion;
    this.env = env;
    this.walletKey = persona.walletKey;
    this.encryptionKeyHex = persona.encryptionKey;

    // Add general message handler
    this.on("message", (message) => {
      console.log(`[${this.name}] Worker message:`, message);
    });

    // Handle worker errors
    this.on("error", (error) => {
      console.error(`[${persona.name}] Worker error:`, error);
    });

    // Handle worker exit
    this.on("exit", (code) => {
      if (code !== 0) {
        console.error(
          `[${persona.name}] Worker stopped with exit code ${code}`,
        );
      }
    });
  }

  /**
   * Initializes the underlying XMTP client in the worker thread.
   * Returns the XMTP Client object for convenience.
   */
  async initialize(): Promise<Client> {
    console.time(`[${this.name}] Initialize XMTP client`);
    // Send initialization message to worker
    this.postMessage({
      type: "initialize",
      data: {
        name: this.name,
        installationId: this.installationId,
        sdkVersion: this.sdkVersion,
        libxmtpVersion: this.libxmtpVersion,
      },
    });

    const signer = createSigner(this.walletKey as `0x${string}`);
    const encryptionKey = getEncryptionKeyFromHex(this.encryptionKeyHex);

    const dbPath = getDbPath(
      this.name,
      await signer.getAddress(),
      this.env,
      this.installationId,
      this.sdkVersion,
      this.libxmtpVersion,
    );
    console.time(`[${this.name}] Create XMTP client`);
    this.client = await Client.create(signer, encryptionKey, {
      env: this.env,
      dbPath,
      // @ts-expect-error: loggingLevel is not typed
      loggingLevel: process.env.LOGGING_LEVEL,
    });
    console.timeEnd(`[${this.name}] Create XMTP client`);

    const version = (Client.version as string).match(/ci@([a-f0-9]+)/)?.[1];
    console.log(`[${this.name}] Client.version: ${version}`);

    // Start streaming in the background
    console.time(`[${this.name}] Start stream`);
    await this.startStream();
    console.timeEnd(`[${this.name}] Start stream`);

    console.time(`[${this.name}] Sync conversations`);
    await this.client.conversations.sync();
    console.timeEnd(`[${this.name}] Sync conversations`);

    console.timeEnd(`[${this.name}] Initialize XMTP client`);
    return this.client;
  }

  /**
   * Internal helper that streams all messages and posts them
   * to the parent thread as { type: 'stream_message' } events.
   */
  private async startStream() {
    console.time(`[${this.name}] Start message stream`);
    const stream = await this.client.conversations.streamAllMessages();
    console.timeEnd(`[${this.name}] Start message stream`);
    console.log(`[${this.name}] Message stream started`);

    void (async () => {
      try {
        for await (const message of stream) {
          console.time(`[${this.name}] Process message`);
          const workerMessage: WorkerMessage = {
            type: "stream_message",
            message: message as DecodedMessage,
          };

          // Only emit messages we're waiting for
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
   * Expose a helper for waiting on a specific incoming message
   * in the parent. This sets up a one-off listener on this Worker
   * to resolve once the specified message text arrives.
   */
  stream(typeId: string): Promise<WorkerMessage> {
    console.log(`[${this.name}] Waiting for message typeId: ${typeId}`);

    return new Promise<WorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener("message", messageHandler);
        reject(new Error(`[${this.name}] Did not receive '${typeId}' in time`));
      }, 10000);

      const messageHandler = (msg: WorkerMessage) => {
        // If it's an error event, reject
        if (msg.type === "error") {
          clearTimeout(timeout);
          this.removeListener("message", messageHandler);
          reject(new Error(`[${this.name}] Error: ${msg.message.content}`));
          return;
        }

        // If it's a matching stream message, resolve
        if (
          msg.type === "stream_message" &&
          msg.message.contentType?.typeId === typeId
        ) {
          clearTimeout(timeout);
          this.removeListener("message", messageHandler);
          resolve(msg);
        }
      };

      this.on("message", messageHandler);
    });
  } /**
   * Collects multiple messages (of a specific type) from this worker.
   * Unlike stream(), this method attaches a persistent listener that collects
   * messages until the specified count is reached.
   *
   * @param typeId The content type to listen for.
   * @param count The number of messages to collect.
   * @param timeoutMs Optional timeout in milliseconds (default: 10,000 ms).
   * @returns A promise that resolves with an array of WorkerMessages.
   */
  collectMessages(
    typeId: string,
    count: number,
    timeoutMs: number = count * 1000, // 2 seconds per expected message
  ): Promise<WorkerMessage[]> {
    console.log(
      `[${this.name}] Collecting ${count} messages of type ${typeId}`,
    );
    return new Promise((resolve, reject) => {
      const messages: WorkerMessage[] = [];
      const timeout = setTimeout(() => {
        this.off("message", handler);
        console.warn(
          `[${this.name}] Timeout reached. Collected ${messages.length} messages out of ${count}.`,
        );
        // Instead of rejecting, resolve with the messages collected so far.
        resolve(messages);
      }, timeoutMs);

      const handler = (msg: WorkerMessage) => {
        // If it's an error event, reject immediately.
        if (msg.type === "error") {
          clearTimeout(timeout);
          this.off("message", handler);
          reject(new Error(`[${this.name}] Error: ${msg.message.content}`));
          return;
        }
        // Accumulate stream messages that match the type.
        if (
          msg.type === "stream_message" &&
          msg.message.contentType?.typeId === typeId
        ) {
          console.log(
            `[${this.name}] Collected message: ${msg.message.content}`,
          );
          messages.push(msg);
          if (messages.length === count) {
            clearTimeout(timeout);
            this.off("message", handler);
            resolve(messages);
          }
        }
      };

      this.on("message", handler);
    });
  }
}
