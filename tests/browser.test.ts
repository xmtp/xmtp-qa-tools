import { loadEnv } from "@helpers/client";
import {
  createDmWithDeeplink,
  createGroupAndReceiveGm,
} from "@helpers/playwright";
import { describe, expect, it } from "vitest";

const testName = "xmtpchat";
loadEnv(testName);
const timeout = 300000;

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
describe(
  testName,
  () => {
    it("should respond to a message", async () => {
      const result = await createDmWithDeeplink(gmBotAddress);
      expect(result).toBe(true);
    });

    it("should respond to a message", async () => {
      const result = await createGroupAndReceiveGm([gmBotAddress]);
      expect(result).toBe(true);
    });
  },
  timeout,
);
