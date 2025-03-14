import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { describe, expect, it } from "vitest";
import { createGroupAndReceiveGm } from "../helpers/playwright";

const testName = "xmtpchat";
loadEnv(testName);
const timeout = 300000;

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
describe(
  testName,
  () => {
    // it("should respond to a message", async () => {
    //   const result = await createGroupAndReceiveGm([gmBotAddress]);
    //   expect(result).toBe(true);
    // });
    it("should create a group and send a message", async () => {
      const randomInboxes = [...generatedInboxes].slice(0, 3);
      const result = await createGroupAndReceiveGm([
        ...randomInboxes.map((inbox) => inbox.accountAddress),
        gmBotAddress,
      ]);
      expect(result).toBe(true);
    });
  },
  timeout,
);
