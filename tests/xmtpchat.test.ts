// gm-bot.test.ts
import { describe, expect, it } from "vitest";
import { testGmBot } from "../playwright/gm-bot.playwright";

describe("GM Bot Test", () => {
  it("should respond to a message", async () => {
    const result = await testGmBot();
    expect(result).toBe(true);
  }, 300000); // Set timeout to 30 seconds
});
