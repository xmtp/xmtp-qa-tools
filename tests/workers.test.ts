import { Worker } from "worker_threads";
import dotenv from "dotenv";
import { describe, it } from "vitest";

dotenv.config();

const TIMEOUT = 80000;

describe("Parallel DM flows using worker threads", () => {
  it(
    "should deliver all messages concurrently",
    async () => {
      console.log("Starting test with timeout of", TIMEOUT, "ms");

      // Create both workers using the same worker file
      console.log("Creating workers...");
      const workerPath = new URL(
        "../helpers/js/client_worker.js",
        import.meta.url,
      );

      const aliceWorker = new Worker(workerPath, {
        stderr: true,
        stdout: true,
      });

      const bobWorker = new Worker(workerPath, {
        stderr: true,
        stdout: true,
      });
      // Add stdout and stderr logging for Alice
      aliceWorker.stdout.on("data", (data) => {
        console.log("Alice stdout:", data.toString());
      });
      aliceWorker.stderr.on("data", (data) => {
        console.error("Alice stderr:", data.toString());
      });

      // Add stdout and stderr logging for Bob
      bobWorker.stdout.on("data", (data) => {
        console.log("Bob stdout:", data.toString());
      });
      bobWorker.stderr.on("data", (data) => {
        console.error("Bob stderr:", data.toString());
      });

      // Initialize both workers with different names
      aliceWorker.postMessage({ type: "initialize", name: "Alice" });
      bobWorker.postMessage({ type: "initialize", name: "Bob" });

      const aliceInitialized = new Promise<string>((resolve, reject) => {
        aliceWorker.on("message", (msg: any) => {
          if (msg.type === "clientInitialized") {
            resolve(msg.clientAddress);
          } else if (msg.type === "error") {
            reject(new Error(msg.error));
          }
        });
      });

      const bobInitialized = new Promise<string>((resolve, reject) => {
        bobWorker.on("message", (msg: any) => {
          if (msg.type === "clientInitialized") {
            resolve(msg.clientAddress);
          } else if (msg.type === "error") {
            reject(new Error(msg.error));
          }
        });
      });

      // Set up message listeners before sending
      const messageHandler = new Promise<{ sent?: string; received?: string }>(
        (resolve, reject) => {
          let messageSent = false;
          let messageReceived = false;

          aliceWorker.on("message", (msg: any) => {
            console.log("Alice worker message:", msg);
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
            console.log("Bob worker message:", msg);
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
          aliceInitialized,
          bobInitialized,
        ]);

        console.log(
          "Alice initialized successfully with address:",
          aliceAddress,
        );
        console.log("Bob initialized successfully with address:", bobAddress);

        // Start Alice listening before Bob sends
        aliceWorker.postMessage({
          type: "receiveMessage",
          senderAddress: bobAddress,
        });

        // Add a small delay to ensure the stream is ready
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Tell Bob to send message to Alice
        bobWorker.postMessage({
          type: "sendMessage",
          recipientAddress: aliceAddress,
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
