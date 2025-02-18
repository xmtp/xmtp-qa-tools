import dotenv from "dotenv";
import { describe, it } from "vitest";
import { createWorkerPair } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 20000;

describe("Parallel DM flows using worker threads", () => {
  it(
    "should deliver all messages concurrently",
    async () => {
      console.log("Starting test with timeout of", TIMEOUT / 1000, "seconds");

      const { aliceWorker, bobWorker } = createWorkerPair(
        new URL("../helpers/worker.ts", import.meta.url),
      );

      // Set up message listeners before sending
      const messageHandler = new Promise<{ sent?: string; received?: string }>(
        (resolve, reject) => {
          let messageSent = false;
          let messageReceived = false;

          aliceWorker.on("message", (msg: any) => {
            if (msg.type === "messageReceived") {
              messageReceived = true;
              if (messageSent) {
                resolve({ sent: msg.message, received: msg.message });
              }
            } else if (msg.type === "error") {
              reject(new Error(msg.error));
            }
          });

          bobWorker.on("message", (msg: any) => {
            if (msg.type === "messageSent") {
              messageSent = true;
              if (messageReceived) {
                resolve({ sent: msg.message, received: msg.message });
              }
            } else if (msg.type === "error") {
              reject(new Error(msg.error));
            }
          });
        },
      );

      try {
        console.log("Waiting for workers to initialize...");

        const [aliceAddress, bobAddress] = await Promise.all([
          aliceWorker.initialize({
            name: "Alice",
            env: "dev",
            version: "42",
            installationId: "a",
          }),
          bobWorker.initialize({
            name: "Bob",
            env: "dev",
            version: "42",
            installationId: "a",
          }),
        ]);

        const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);

        // Start Alice listening before Bob sends
        aliceWorker.postMessage({
          type: "receiveMessage",
          senderAddress: bobAddress,
          expectedMessage: gmMessage,
        });

        // Add a small delay to ensure the stream is ready
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Tell Bob to send message to Alice
        bobWorker.postMessage({
          type: "sendMessage",
          recipientAddress: aliceAddress,
          message: gmMessage,
        });

        // Wait for both operations to complete
        const result = await messageHandler;
        console.log("Message exchange complete:", result);
      } catch (error) {
        console.error("Failed during message exchange:", error);
        throw error;
      }
    },
    TIMEOUT,
  );
});
