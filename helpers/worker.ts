/* eslint-disable */
import { parentPort, Worker, type WorkerOptions } from "node:worker_threads";
import { TestLogger } from "./logger";
import { ClientManager } from "./manager";

const defaultVersion = "42";
const defaultInstallationId = "a";

// Types
export type WorkerMessage = {
  type: string;
  [key: string]: any;
};

export type WorkerConfig = {
  name: string;
  env?: string;
  version?: string;
  installationId?: string;
  logger: TestLogger;
};

// Worker bootstrap code
const workerBootstrap = /* JavaScript */ `
  import { createRequire } from "node:module";
  import { workerData } from "node:worker_threads";

  const filename = "${import.meta.url}";
  const require = createRequire(filename);
  const { tsImport } = require("tsx/esm/api");
  
  tsImport(workerData.__ts_worker_filename, filename);
`;

// Main Worker Client class
export class WorkerClient extends Worker {
  public name: string;
  private logger: TestLogger;

  constructor(filename: string | URL, options: WorkerOptions = {}) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = filename.toString();
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
  }

  setupLogging() {
    if (this.stdout) {
      this.stdout.on("data", (data) => {
        this.logger.log(`[${this.name}] ${data.toString().trim()}`);
      });
    }
    if (this.stderr) {
      this.stderr.on("data", (data) => {
        this.logger.log(`[${this.name}] ${data.toString().trim()}`);
      });
    }
    return this;
  }

  async initialize(config: WorkerConfig): Promise<string> {
    this.postMessage({
      type: "initialize",
      ...config,
    });
    this.logger = config.logger;

    const response = await this.waitForMessage<{ clientAddress: string }>(
      "clientInitialized",
    );

    this.logger.log(
      `[${this.name}] initialized with: ${JSON.stringify({
        env: config.env,
        version: config.version || defaultVersion,
        installationId: config.installationId || defaultInstallationId,
      })}`,
    );
    return response.clientAddress;
  }

  async sendMessage(recipientAddress: string, message: string): Promise<void> {
    this.logger.log(
      `[${this.name}] Sending message to ${recipientAddress}: ${message}`,
    );
    this.postMessage({ type: "sendMessage", recipientAddress, message });
    await this.waitForMessage("messageSent");
  }

  async receiveMessage(
    senderAddress: string,
    expectedMessage: string,
  ): Promise<string> {
    this.logger.log(`[${this.name}] Waiting for message from ${senderAddress}`);
    this.postMessage({
      type: "receiveMessage",
      senderAddress,
      expectedMessage,
    });
    const response = await this.waitForMessage<{ message: string }>(
      "messageReceived",
    );
    this.logger.log(`[${this.name}] Received message: ${expectedMessage}`);
    return response.message;
  }

  private async waitForMessage<T = any>(messageType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (msg: WorkerMessage) => {
        if (msg.type === messageType) {
          this.removeListener("message", handler);
          resolve(msg as T);
        } else if (msg.type === "error") {
          this.removeListener("message", handler);
          this.logger.log(`[${this.name}] Error: ${msg.error}`);
          reject(new Error(msg.error));
        }
      };
      this.on("message", handler);
    });
  }

  static createWorker(name: string, workerPath: string | URL): WorkerClient {
    const worker = new WorkerClient(workerPath, { stderr: true, stdout: true });
    worker.name = name;
    return worker.setupLogging();
  }
}

// Helper function to create worker pairs
export function createWorkerPair(workerPath: string | URL) {
  const aliceWorker = WorkerClient.createWorker("Alice", workerPath);
  const bobWorker = WorkerClient.createWorker("Bob", workerPath);
  return { aliceWorker, bobWorker };
}

// Worker implementation (runs in worker thread)
if (parentPort) {
  let client: ClientManager | undefined;
  let workerLogger: TestLogger | undefined;

  parentPort.on("message", async (data: WorkerMessage) => {
    try {
      switch (data.type) {
        case "initialize": {
          workerLogger?.log(`[${data.name}:Thread] Initializing client`);

          client = new ClientManager({
            env: data.env || "dev",
            version: data.version || "42",
            name: data.name,
            installationId: data.installationId || "a",
            logger: workerLogger,
          });
          await client.initialize();

          workerLogger?.log(
            `[${data.name}:Thread] Client initialized with address: ${client.client.accountAddress}`,
          );
          parentPort?.postMessage({
            type: "clientInitialized",
            clientAddress: client.client.accountAddress,
            clientName: data.name,
          });
          break;
        }

        case "sendMessage": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log(
            `[${client.name}:Thread] Sending message to ${data.recipientAddress}`,
          );
          await client.sendMessage(data.recipientAddress, data.message);
          workerLogger?.log(
            `[${client.name}:Thread] Message sent successfully`,
          );
          parentPort?.postMessage({
            type: "messageSent",
            message: data.message,
          });
          break;
        }

        case "receiveMessage": {
          if (!client) throw new Error("Client not initialized");
          workerLogger?.log(`[${client.name}:Thread] Waiting for message`);
          const message = await client.receiveMessage(data.expectedMessage);
          workerLogger?.log(
            `[${client.name}:Thread] Message received: ${message}`,
          );
          parentPort?.postMessage({
            type: "messageReceived",
            message: message,
          });
          break;
        }
      }
    } catch (error: any) {
      if (workerLogger) {
        const workerName = client?.config?.name || data?.name || "Unknown";
        workerLogger.log(
          `[${workerName}:Thread] Error: ${error.message || String(error)}`,
        );
      }
      parentPort?.postMessage({
        type: "error",
        error: error.message || String(error),
      });
    }
  });
}
