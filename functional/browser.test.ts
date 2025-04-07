import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
describe(testName, () => {
  const xmtpTester = new XmtpPlaywright(false, "dev");

  it("should respond to a message", async () => {
    await xmtpTester.createDmWithDeeplink(gmBotAddress);
  });

  it("should create a group and send a message", async () => {
    try {
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
