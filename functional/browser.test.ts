import { loadEnv } from "@helpers/client";
import { XmtpPlaywright } from "@helpers/playwright";
import type { XmtpEnv } from "@helpers/types";
import { describe, expect, it } from "vitest";

const testName = "xmtpchat";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
describe(testName, () => {
  it("should respond to a message", async () => {
    // Create an instance
    const xmtpTester = new XmtpPlaywright(false, "dev");
    await xmtpTester.createGroupAndReceiveGm([gmBotAddress]);
  });
});
