import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  // Check if GM_BOT_ADDRESS environment variable is set
  const gmBotAddress = process.env.GM_BOT_ADDRESS;

  it("should respond to a message", async () => {
    console.log("sending gm to bot", gmBotAddress);
    try {
      if (!gmBotAddress) {
        throw new Error("GM_BOT_ADDRESS environment variable is not set");
      }

      const xmtpTester = new XmtpPlaywright(true, "production");
      const result = await xmtpTester.newDmWithDeeplink(
        gmBotAddress,
        "hi",
        "gm",
      );
      expect(result).toBe(true);
    } catch (error) {
      console.error("Error in browser test:", error);
      throw error;
    }
  });

  it("should create a group and send a message", async () => {
    try {
      if (!gmBotAddress) {
        throw new Error("GM_BOT_ADDRESS environment variable is not set");
      }

      const xmtpTester = new XmtpPlaywright(true, "production");
      const slicedInboxes = generatedInboxes.slice(0, 4);
      await xmtpTester.createGroupAndReceiveGm([
        ...slicedInboxes.map((inbox) => inbox.accountAddress),
        gmBotAddress,
      ]);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
});
