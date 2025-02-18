import { parentPort } from "worker_threads";
import dotenv from "dotenv";
import { ClientManager } from "./worker_manager.js";

dotenv.config();

(async () => {
  try {
    let client;

    // Listen for messages
    parentPort.on("message", async (data) => {
      console.log("worker received message", data);

      // Initialize client when name is received
      if (data.type === "initialize" && data.name) {
        try {
          client = new ClientManager({
            env: "dev",
            version: "42",
            name: data.name,
            installationId: "a",
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
        } catch (error) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      } else if (data.type === "sendMessage" && data.recipientAddress) {
        try {
          if (!client) {
            throw new Error("Client not initialized");
          }
          console.log(
            `${client.name} sending message to`,
            data.recipientAddress,
          );
          await client.sendMessage(data.recipientAddress, "gm");
          parentPort.postMessage({
            type: "messageSent",
            message: "gm",
          });
        } catch (error) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      } else if (data.type === "receiveMessage" && data.senderAddress) {
        console.log(
          `${client.name} receiving message from`,
          data.senderAddress,
        );
        try {
          if (!client) {
            throw new Error("Client not initialized");
          }
          const message = await client.receiveMessage("gm");
          parentPort.postMessage({
            type: "messageReceived",
            message: message,
          });
        } catch (error) {
          parentPort.postMessage({
            type: "error",
            error: error.message || String(error),
          });
        }
      }
    });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      error: error.message || String(error),
    });
  }
})();
