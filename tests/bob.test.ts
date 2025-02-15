/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import dotenv from "dotenv";
import { describe, expect, it } from "vitest";
import { AgentManager } from "../helpers/manager";

dotenv.config();

const TIMEOUT = 50000;
describe("Centralized test for multiple agents", () => {
  it(
    "should initialize and run alice and bob agents and verify message flow",
    async () => {
      const bob = new AgentManager({
        env: "dev",
        version: "39",
        name: "Bob",
        installationId: "a",
      });

      const alice = new AgentManager({
        env: "dev",
        version: "40",
        name: "Alice",
        installationId: "a",
      });

      await bob.initialize();
      await alice.initialize();

      const aliceAddress = alice.client.accountAddress as string;

      await Promise.all([
        alice.waitForReply("Hello, Alice!"),
        bob.sendMessage(aliceAddress, "Hello, Alice!"),
      ]);
      //const bobReceivedGM = await bob.waitForReply("gm");

      // console.log("message", message);
      // console.log("aliceReplied", aliceReplied);

      // const bobReceivedGM = await bob.waitForReply("gm");
      // console.log("bobReceivedGM", bobReceivedGM);

      // expect(aliceReplied).toBe(true);
      // expect(bobReceivedGM).toBe(true);
    },
    TIMEOUT,
  );
});
