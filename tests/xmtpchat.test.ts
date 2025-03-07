import { loadEnv } from "@helpers/client";
import { describe, expect, it } from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
const testName = "xmtpchat";

loadEnv(testName);
describe("GM Bot Test", () => {
  it("should respond to a message", async () => {
    const result = await testGmBot(gmBotAddress);
    expect(result).toBe(true);
  }, 300000);
});
