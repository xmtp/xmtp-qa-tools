/* eslint-disable */

import { parentPort, Worker, type WorkerOptions } from "node:worker_threads";
import { ClientManager } from "./manager";

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
  name: string;

  constructor(filename: string | URL, options: WorkerOptions = {}) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = filename.toString();
    super(new URL(`data:text/javascript,${workerBootstrap}`), options);
  }

  setupLogging(name: string) {
    this.name = name;
    if (this.stdout) {
      this.stdout.on("data", (data) => {
        console.log(`${name} stdout:`, data.toString());
      });
    }
    if (this.stderr) {
      this.stderr.on("data", (data) => {
        console.error(`${name} stderr:`, data.toString());
      });
    }
    return this;
  }

  async initialize(config: WorkerConfig): Promise<string> {
    this.postMessage({ type: "initialize", ...config });
    const response = await this.waitForMessage<{ clientAddress: string }>(
      "clientInitialized",
    );
    console.log(`Created client for ${this.name}`, {
      env: config.env,
      version: config.version,
      installationId: config.installationId,
      clientAddress: response.clientAddress,
    });
    return response.clientAddress;
  }

  async sendMessage(recipientAddress: string, message: string): Promise<void> {
    this.postMessage({ type: "sendMessage", recipientAddress, message });
    await this.waitForMessage("messageSent");
  }

  async receiveMessage(
    senderAddress: string,
    expectedMessage: string,
  ): Promise<string> {
    this.postMessage({
      type: "receiveMessage",
      senderAddress,
      expectedMessage,
    });
    const response = await this.waitForMessage<{ message: string }>(
      "messageReceived",
    );
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
          reject(new Error(msg.error));
        }
      };
      this.on("message", handler);
    });
  }

  static createWorker(name: string, workerPath: string | URL): WorkerClient {
    const worker = new WorkerClient(workerPath, { stderr: true, stdout: true });
    return worker.setupLogging(name);
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

  parentPort.on("message", async (data: WorkerMessage) => {
    try {
      switch (data.type) {
        case "initialize": {
          client = new ClientManager({
            env: data.env || "dev",
            version: data.version || "42",
            name: data.name,
            installationId: data.installationId || "a",
          });
          await client.initialize();
          parentPort.postMessage({
            type: "clientInitialized",
            clientAddress: client.client.accountAddress,
            clientName: data.name,
          });
          break;
        }

        case "sendMessage": {
          if (!client) throw new Error("Client not initialized");
          await client.sendMessage(data.recipientAddress, data.message);
          parentPort.postMessage({
            type: "messageSent",
            message: data.message,
          });
          break;
        }

        case "receiveMessage": {
          if (!client) throw new Error("Client not initialized");
          const message = await client.receiveMessage(data.expectedMessage);
          parentPort.postMessage({
            type: "messageReceived",
            message: message,
          });
          break;
        }
      }
    } catch (error: any) {
      parentPort.postMessage({
        type: "error",
        error: error.message || String(error),
      });
    }
  });
}
