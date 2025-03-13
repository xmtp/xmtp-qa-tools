import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { describe, expect, it } from "vitest";
import {
  createGroupAndReceiveGm,
  testGmBot,
} from "../playwright/gm-bot.playwright";

const testName = "xmtpchat";
loadEnv(testName);
const timeout = 300000;
describe(
  testName,
  () => {
    // it("should respond to a message", async () => {
    //   const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
    //   const result = await testGmBot(gmBotAddress);
    //   expect(result).toBe(true);
    // });
    it("should create a group and send a message", async () => {
      const randomInboxes = [...generatedInboxes]
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const result = await createGroupAndReceiveGm(
        randomInboxes.map((inbox) => inbox.accountAddress),
      );
      expect(result).toBe(true);
    });
  },
  timeout,
);
