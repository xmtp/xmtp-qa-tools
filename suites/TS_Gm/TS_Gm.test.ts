import { loadEnv } from "@helpers/client";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { defaultValues, sleep } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "ts_gm";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;

describe(testName, () => {
  let convo: Conversation;
  let workers: WorkerManager;

  const xmtpTester = new XmtpPlaywright({ headless: false, env: "production" });
  beforeAll(async () => {
    await xmtpTester.startPage();
    workers = await getWorkers(
      ["bob"],
      testName,
      typeofStream.Message,
      typeOfResponse.Gm,
      "production",
    );
  });
  setupTestLifecycle({
    expect,
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
      await sleep(defaultValues.streamTimeout);
      await convo.sync();
      const messagesAfter = await convo.messages();
      expect(messagesAfter.length).toBe(prevMessageCount + 2);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      await xmtpTester.newDmFromUI(gmBotAddress);
      await xmtpTester.sendMessage("hi");
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (error) {
      await xmtpTester.takeSnapshot(gmBotAddress);
      logError(error, gmBotAddress);
      throw error;
    }
  });
  it("should create a group and send a message", async () => {
    try {
      await xmtpTester.newGroupFromUI([
        ...generatedInboxes.slice(0, 4).map((inbox) => inbox.accountAddress),
        gmBotAddress,
      ]);
      await xmtpTester.sendMessage("hi");
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot(gmBotAddress);
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
