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

export class TsWorker extends Worker {
  constructor(filename: string | URL, options: WorkerOptions = {}) {
    options.workerData ??= {};
    options.workerData.__ts_worker_filename = filename.toString();
    super(new URL(`data:text/javascript,${worker}`), options);
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
      console.log("worker received message", data);

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
          console.log(
            `[${data.name.toUpperCase()} WORKER] Initialized with address:`,
            client.client.accountAddress,
          );

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
