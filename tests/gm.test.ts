import fs from "fs";
import dotenv from "dotenv";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ClientManager } from "../helpers/manager";

dotenv.config();

const TIMEOUT = 20000;

describe("Test for different DM flows", () => {
  beforeAll(() => {
    fs.rmSync(".data", { recursive: true, force: true });
  });

  it(
    "should initialize bob and alice and send a message",
    async () => {
      const bob = new ClientManager({
        env: "dev",
        version: "38",
        name: "Bob",
        installationId: "a",
      });

      const alice = new ClientManager({
        env: "dev",
        version: "38",
        name: "Alice",
        installationId: "a",
      });

      await bob.initialize();
      await alice.initialize();

      const aliceAddress = alice.client.accountAddress;
      console.log("aliceAddress", aliceAddress);

      const gm = "gm-" + Math.random().toString(36).substring(2, 15);

      let receivedMessage = false;
      await Promise.all([
        alice.waitForReply(gm).then((result) => (receivedMessage = result)),
        bob.sendMessage(aliceAddress, gm),
      ]);
      expect(receivedMessage).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "should initialize bob and alice on existing installations and send a message",
    async () => {
      const bob = new ClientManager({
        env: "dev",
        version: "38",
        name: "Bob",
        installationId: "a",
      });

      const alice = new ClientManager({
        env: "dev",
        version: "38",
        name: "Alice",
        installationId: "a",
      });

      await bob.initialize();
      await alice.initialize();

      const aliceAddress = alice.client.accountAddress;
      console.log("aliceAddress", aliceAddress);

      const gm = "gm-" + Math.random().toString(36).substring(2, 15);

      let receivedMessage = false;
      await Promise.all([
        alice.waitForReply(gm).then((result) => (receivedMessage = result)),
        bob.sendMessage(aliceAddress, gm),
      ]);
      expect(receivedMessage).toBe(true);
    },
    TIMEOUT,
  );
});
