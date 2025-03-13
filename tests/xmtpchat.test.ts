import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import type { XmtpEnv } from "@helpers/types";
import { describe, expect, it } from "vitest";
import {
  createGroupAndReceiveGm,
  testGmBot,
} from "../playwright/gm-bot.playwright";

const testName = "xmtpchat";
loadEnv(testName);
const timeout = 300000;
const env = process.env.XMTP_ENV as XmtpEnv;
const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
const WALLET_KEY_XMTP_CHAT = process.env.WALLET_KEY_XMTP_CHAT as string;
const ENCRYPTION_KEY_XMTP_CHAT = process.env.ENCRYPTION_KEY_XMTP_CHAT as string;

describe(
  testName,
  () => {
    // it("should respond to a message", async () => {
    //   const gmBotAddress = process.env.GM_BOT_ADDRESS as string;
    //   const result = await testGmBot(gmBotAddress);
    //   expect(result).toBe(true);
    // });
    it("should create a group and send a message", async () => {
      const randomInboxes = [...generatedInboxes].slice(0, 3);
      const result = await createGroupAndReceiveGm(
        [...randomInboxes.map((inbox) => inbox.accountAddress), gmBotAddress],
        env,
        WALLET_KEY_XMTP_CHAT,
        ENCRYPTION_KEY_XMTP_CHAT,
      );
      expect(result).toBe(true);
    });
  },
  timeout,
);
