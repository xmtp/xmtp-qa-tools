import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { defaultValues } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "ts_gm";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;

describe(testName, () => {
  let convo: Conversation;
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  const xmtpTester = new XmtpPlaywright({ headless: false, env: "production" });

  beforeAll(async () => {
    try {
      workers = await getWorkers(
        ["bob"],
        testName,
        "message",
        "gm",
        "production",
      );
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(1);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("gm-bot: should check if bot is alive", async () => {
    try {
      // Create conversation with the bot
      convo = await workers
        .get("bob")!
        .client.conversations.newDmWithIdentifier({
          identifierKind: IdentifierKind.Ethereum,
          identifier: gmBotAddress,
        });

      await convo.sync();
      const messages = await convo.messages();
      const prevMessageCount = messages.length;
      console.log("prevMessageCount", prevMessageCount);
      // Send a simple message
      const sentMessageId = await convo.send("gm");
      console.log("sentMessageId", sentMessageId);
      await new Promise((resolve) =>
        setTimeout(resolve, defaultValues.streamTimeout),
      );
      await convo.sync();
      const messagesAfter = await convo.messages();
      expect(messagesAfter.length).toBe(prevMessageCount + 2);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      const result = await xmtpTester.newDmWithDeeplink(
        gmBotAddress,
        "hi",
        "gm",
      );
      expect(result).toBe(true);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
  it("should create a group and send a message", async () => {
    try {
      const slicedInboxes = generatedInboxes.slice(0, 4);
      await xmtpTester.createGroupAndReceiveGm([
        ...slicedInboxes.map((inbox) => inbox.accountAddress),
        gmBotAddress,
      ]);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
