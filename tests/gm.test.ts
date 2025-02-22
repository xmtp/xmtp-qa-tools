import dotenv from "dotenv";
import { describe, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { WorkerClient } from "../helpers/worker";

dotenv.config();

const TIMEOUT = 20000;
const testName = "gm";
const logger = createLogger(testName);
overrideConsole(logger);
describe("Test for different GM flows", () => {
  let bob: WorkerClient, alice: WorkerClient;

  it(
    "Should initialize bob and alice",
    async () => {
      bob = new WorkerClient(
        {
          version: "42",
          name: "Bob",
          installationId: "a",
        },
        "dev",
      );
      alice = new WorkerClient(
        {
          version: "42",
          name: "Alice",
          installationId: "a",
        },
        "dev",
      );
      const { address: bobAddress, inboxId: bobInboxId } =
        await bob.initialize(testName);
      console.log("bobAddress", bobAddress);
      console.log("bobInboxId", bobInboxId);
      const { address: aliceAddress, inboxId: aliceInboxId } =
        await alice.initialize(testName);
      console.log("aliceAddress", aliceAddress);
      console.log("aliceInboxId", aliceInboxId);

      // create Dm
      const dmId = await bob.createDM(aliceAddress);
      console.log("dmId", dmId);

      // send gm
      const alicePromise = alice.receiveMessage(dmId, ["Hello, world!"]);
      await bob.sendMessage(dmId, "Hello, world!");
      console.log("gm sent");
      const aliceMessages = await alicePromise;
      console.log("aliceMessages", aliceMessages);
    },
    TIMEOUT,
  );
});
