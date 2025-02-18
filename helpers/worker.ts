/* eslint-disable */
import { Worker, type WorkerOptions } from "node:worker_threads";
import { parentPort } from "worker_threads";
import dotenv from "dotenv";
import { ClientManager } from "./manager";

const worker = /* JavaScript */ `
  import { createRequire } from "node:module";
  import { workerData } from "node:worker_threads";

  const filename = "${import.meta.url}";
  const require = createRequire(filename);
  const { tsImport } = require("tsx/esm/api");
  
  tsImport(workerData.__ts_worker_filename, filename);
`;
export function createWorkerPair(workerPath: string | URL): {
  aliceWorker: TsWorker;
  bobWorker: TsWorker;
} {
  const aliceWorker = TsWorker.createWorker("Alice", workerPath);
  const bobWorker = TsWorker.createWorker("Bob", workerPath);

  return { aliceWorker, bobWorker };
}
export class TsWorker extends Worker {
  name: string;

  constructor(filename: string | URL, options: WorkerOptions = {}) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = filename.toString();
    super(new URL(`data:text/javascript,${worker}`), options);
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

  static createWorker(name: string, workerPath: string | URL): TsWorker {
    const worker = new TsWorker(workerPath, {
      stderr: true,
      stdout: true,
    });
    return worker.setupLogging(name);
  }
  async initialize(config: {
    name: string;
    env?: string;
    version?: string;
    installationId?: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      this.postMessage({
        type: "initialize",
        ...config,
      });

      this.on("message", (msg: WorkerMessage) => {
        if (msg.type === "clientInitialized") {
          console.log(
            `${this.name} initialized successfully with address:`,
            msg.clientAddress,
          );
          resolve(msg.clientAddress);
        } else if (msg.type === "error") {
          reject(new Error(msg.error));
        }
      });
    });
  }
  async waitForMessage<T = any>(messageType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (msg: any) => {
        if (msg.type === messageType) {
          this.removeListener("message", handler);
          resolve(msg);
        } else if (msg.type === "error") {
          this.removeListener("message", handler);
          reject(new Error(msg.error));
        }
      };
      this.on("message", handler);
    });
  }
}

dotenv.config();

if (!parentPort) {
  throw new Error("This file should be run as a worker.");
}

(async () => {
  try {
    let client: ClientManager | undefined;

    // Listen for messages
    parentPort.on("message", async (data: any) => {
      // Initialize client when name is received
      if (data.type === "initialize" && data.name) {
        try {
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
        } catch (error: any) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      } else if (
        data.type === "sendMessage" &&
        data.recipientAddress &&
        data.message
      ) {
        try {
          if (!client) {
            throw new Error("Client not initialized");
          }
          console.log(
            `${client.name} sending message to`,
            data.recipientAddress,
          );
          await client.sendMessage(data.recipientAddress, data.message);
          parentPort.postMessage({
            type: "messageSent",
            message: data.message,
          });
        } catch (error: any) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      } else if (
        data.type === "receiveMessage" &&
        data.senderAddress &&
        data.expectedMessage
      ) {
        console.log(
          `${client?.name} receiving message from`,
          data.senderAddress,
        );
        try {
          if (!client) {
            throw new Error("Client not initialized");
          }
          const message = await client.receiveMessage(data.expectedMessage);
          parentPort.postMessage({
            type: "messageReceived",
            message: message,
          });
        } catch (error: any) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      }
    });
  } catch (error: any) {
    parentPort.postMessage({
      type: "error",
      error: error.message || String(error),
    });
  }
})();
