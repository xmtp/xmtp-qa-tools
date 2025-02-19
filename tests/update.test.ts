import dotenv from "dotenv";
import type { XmtpEnv } from "node-sdk-41";
import { describe, it } from "vitest";
import { createWorkerPair } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 20000;
const environments: XmtpEnv[] = ["dev"];
const versions = ["41", "42"];
const installationIds = ["a", "b"];

describe("Test updating the same installation", () => {
  it(
    "should initialize bob and alice and send a message and then update the installation and send the same message again",
    async () => {
      try {
        const { aliceWorker, bobWorker } = createWorkerPair(
          new URL("../helpers/worker.ts", import.meta.url),
        );
        // Initialize workers
        const [aliceAddress, bobAddress] = await Promise.all([
          aliceWorker.initialize({
            name: "Alice",
            env: environments[0],
            installationId: installationIds[0],
            version: versions[0],
          }),
          bobWorker.initialize({
            name: "Bob",
            env: environments[0],
            installationId: installationIds[0],
            version: versions[0],
          }),
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

        const [aliceAddressUpdated, bobAddressUpdated] = await Promise.all([
          aliceWorker.initialize({
            name: "Alice",
            env: environments[0],
            installationId: installationIds[0],
            version: versions[1],
          }),
          bobWorker.initialize({
            name: "Bob",
            env: environments[0],
            installationId: installationIds[0],
            version: versions[1],
          }),
        ]);

        // Set up receive before send
        const receivePromiseUpdated = aliceWorker.receiveMessage(
          bobAddressUpdated,
          gmMessage,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Send and wait for completion
        await bobWorker.sendMessage(aliceAddressUpdated, gmMessage);
        const receivedMessageUpdated = await receivePromiseUpdated;

        console.log("Message exchange complete:", {
          sent: gmMessage,
          received: receivedMessageUpdated,
        });
      } catch (error) {
        console.error("Failed during message exchange:", error);
        throw error;
      }
    },
    TIMEOUT,
  );
});
