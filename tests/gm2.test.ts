import dotenv from "dotenv";
import { describe, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { ClientManager } from "../helpers/manager";

dotenv.config();

const TIMEOUT = 20000;
const testName = "gm";
const logger = createLogger(testName);
overrideConsole(logger);
describe("Test for different GM flows", () => {
  let bob: ClientManager, alice: ClientManager;

  it(
    "Should initialize bob and alice",
    async () => {
      bob = new ClientManager({
        version: "42",
        name: "Bob",
        installationId: "a",
        env: "dev",
      });
      alice = new ClientManager({
        version: "42",
        name: "Alice",
        installationId: "a",
        env: "dev",
      });
      await bob.initialize();
      await alice.initialize();

      console.log("bob.address", bob.client.accountAddress);
      console.log("alice.address", alice.client.accountAddress);

      const dmId = await bob.newDM(alice.client.accountAddress);
      console.log("dmId", dmId);

      const [bobMessage, aliceMessage] = await Promise.all([
        bob.send(dmId, "Hello, world!"),
        alice.receiveMessage(dmId, ["Hello, world!"]),
      ]);
      console.log("bobMessage", bobMessage);
      console.log("aliceMessage", aliceMessage);
    },
    TIMEOUT,
  );
});
