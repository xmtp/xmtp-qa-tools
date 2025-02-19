import dotenv from "dotenv";
import { describe, it } from "vitest";
import { createWorkerPair } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 20000;

describe("Test for different DM flows", () => {
  it(
    "should initialize bob and alice and send a message using workers",
    async () => {
      try {
        const { aliceWorker, bobWorker } = createWorkerPair(
          new URL("../helpers/worker.ts", import.meta.url),
        );
        // Initialize workers
        const [aliceAddress, bobAddress] = await Promise.all([
          aliceWorker.initialize({ name: "Alice", env: "dev" }),
          bobWorker.initialize({ name: "Bob", env: "dev" }),
        ]);

        const gmMessage = "gm-" + Math.random().toString(36).substring(2, 15);

        // Set up receive before send
        const receivePromise = aliceWorker.receiveMessage(
          bobAddress,
          gmMessage,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Send and wait for completion
        await bobWorker.sendMessage(aliceAddress, gmMessage);
        const receivedMessage = await receivePromise;

        console.log("Message exchange complete:", {
          sent: gmMessage,
          received: receivedMessage,
        });
      } catch (error) {
        console.error("Failed during message exchange:", error);
        throw error;
      }
    },
    TIMEOUT,
  );
});
