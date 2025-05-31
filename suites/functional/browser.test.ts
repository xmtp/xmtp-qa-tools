import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import { getInboxIds, GM_BOT_ADDRESS } from "@helpers/utils";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  const xmtpTester = new playwright({
    headless: true,
    env: "production",
  });

  beforeAll(async () => {
    await xmtpTester.startPage();
  });

  it("should respond to a message", async () => {
    try {
      await xmtpTester.newDmFromUI(GM_BOT_ADDRESS);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
    } catch (error) {
      console.error("Error in browser test:", error);
      throw error;
    }
  });

  it("should create a group and send a message", async () => {
    try {
      const slicedInboxes = getInboxIds(4);
      await xmtpTester.newGroupFromUI([...slicedInboxes, GM_BOT_ADDRESS]);
      await xmtpTester.sendMessage("hi");
      await xmtpTester.waitForResponse(["gm"]);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
