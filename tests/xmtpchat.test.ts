// gm-bot.test.ts
import { describe, expect, it } from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

const gmBotAddress = "0x3237451eb4b3Cd648fdcD9c7818C9B64b60e82fA";
describe("GM Bot Test", () => {
  it("should respond to a message", async () => {
    const result = await testGmBot(gmBotAddress);
    expect(result).toBe(true);
  }, 300000);
});
