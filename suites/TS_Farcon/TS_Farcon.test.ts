import { loadEnv } from "@helpers/client";
import { XmtpPlaywright } from "@helpers/playwright";
import { describe, expect, it } from "vitest";

const testName = "browser";
loadEnv(testName);

describe(testName, () => {
  // Check if GM_BOT_ADDRESS environment variable is set
  const gmBotAddress = "0xD75FaA8A834570b4df073500F31E3103227299ed";

  it("should respond to a message", async () => {
    console.log("sending gm to bot", gmBotAddress);
    try {
      if (!gmBotAddress) {
        throw new Error("GM_BOT_ADDRESS environment variable is not set");
      }

      const xmtpTester = new XmtpPlaywright(true, "dev", true);
      const result = await xmtpTester.newDmWithDeeplink(
        gmBotAddress,
        "hi",
        "You've been added to the Farcon group. Check your message requests in your inbox to view",
      );
      expect(result).toBe(true);
    } catch (error) {
      console.error("Error in browser test:", error);
      throw error;
    }
  });
});
