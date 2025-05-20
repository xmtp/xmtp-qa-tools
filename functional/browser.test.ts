import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  // Check if GM_BOT_ADDRESS environment variable is set
  const xmtpTester = new XmtpPlaywright({
    headless: true,
    env: "production",
  });
  const gmBotAddress = process.env.GM_BOT_ADDRESS;

  beforeAll(async () => {
    await xmtpTester.startPage();
  });

  it("should respond to a message", async () => {
    try {
      if (!gmBotAddress) {
        throw new Error("GM_BOT_ADDRESS environment variable is not set");
      }

      await xmtpTester.newDmFromUI(gmBotAddress);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
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
      const slicedInboxes = generatedInboxes.slice(0, 4);
      await xmtpTester.newGroupFromUI([
        ...slicedInboxes.map((inbox) => inbox.accountAddress),
        gmBotAddress,
      ]);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
