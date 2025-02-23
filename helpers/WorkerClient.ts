import { Worker, type WorkerOptions } from "node:worker_threads";
import { Client, type Signer, type XmtpEnv } from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createSigner, dbPath, getEncryptionKeyFromHex } from "./client"; // Adapt these imports
import type { Persona } from "./personas";

dotenv.config();

export type WorkerMessage = {
  type: string;
  data: {
    content: string;
    conversationId?: string;
    senderAddress?: string;
  };
};

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
  private version: string;

  private signer!: Signer;
  private encryptionKey!: Uint8Array;

  public client!: Client; // Expose the XMTP client if you need direct DM send

  constructor(persona: Persona, env: XmtpEnv, options: WorkerOptions = {}) {
    options.workerData = {
      __ts_worker_filename: new URL("../helpers/worker.ts", import.meta.url)
        .pathname,
      persona,
      env,
    };

    super(new URL(`data:text/javascript,${workerBootstrap}`), options);

    this.name = persona.name;
    this.installationId = persona.installationId;
    this.version = persona.version;
    this.env = env;

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
    // Read keys from process.env
    const walletKey = process.env[
      `WALLET_KEY_${this.name.toUpperCase()}`
    ] as `0x${string}`;
    const encryptionKey = process.env[
      `ENCRYPTION_KEY_${this.name.toUpperCase()}`
    ] as string;

    this.signer = createSigner(walletKey);
    this.encryptionKey = getEncryptionKeyFromHex(encryptionKey);

    // Create the XMTP client
    this.client = await Client.create(this.signer, this.encryptionKey, {
      env: this.env,
      dbPath: dbPath(this.name, this.installationId, this.env),
    });

    // Wait for sync
    await this.client.conversations.sync();
    console.log(`[${this.name}] Sync completed`);

    // Start streaming in the background
    await this.startStream();

    return this.client;
  }

  /**
   * Internal helper that streams all messages and posts them
   * to the parent thread as { type: 'stream_message' } events.
   */
  private async startStream() {
    console.time("startStream");
    const stream = await this.client.conversations.streamAllMessages();
    console.log(`[${this.name}] Message stream started`);
    console.timeEnd("startStream");

    void (async () => {
      try {
        for await (const message of stream) {
          if (!message?.content) continue;

          const workerMessage: WorkerMessage = {
            type: "stream_message",
            data: {
              content: message.content as string,
              conversationId: message.conversationId,
              senderAddress: message.senderInboxId,
            },
          };

          // Only emit messages we're waiting for
          if (this.listenerCount("message") > 0) {
            this.emit("message", workerMessage);
          }
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
  receiveMessage(expectedContent: string): Promise<WorkerMessage> {
    console.log(`[${this.name}] Waiting for message: ${expectedContent}`);

    return new Promise<WorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener("message", messageHandler);
        reject(
          new Error(`Timeout: Did not receive '${expectedContent}' in time`),
        );
      }, 10000);

      const messageHandler = (msg: WorkerMessage) => {
        // If it's an error event, reject
        if (msg.type === "error") {
          clearTimeout(timeout);
          this.removeListener("message", messageHandler);
          reject(new Error(msg.data.content));
          return;
        }

        // If it's a matching stream message, resolve
        if (
          msg.type === "stream_message" &&
          msg.data.content === expectedContent
        ) {
          clearTimeout(timeout);
          this.removeListener("message", messageHandler);
          resolve(msg);
        }
      };

      this.on("message", messageHandler);
    });
  }
}
