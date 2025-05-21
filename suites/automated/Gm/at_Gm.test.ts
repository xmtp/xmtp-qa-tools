import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { XmtpPlaywright } from "@helpers/playwright";
import { verifyDmStream } from "@helpers/streams";
import { getInboxIds } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "at_gm";
loadEnv(testName);

const gmBotAddress = process.env.GM_BOT_ADDRESS as string;

describe(testName, () => {
  let convo: Conversation;
  let workers: WorkerManager;

  const xmtpTester = new XmtpPlaywright({
    headless: true,
    env: "production",
  });
  beforeAll(async () => {
    workers = await getWorkers(
      ["bob"],
      testName,
      typeofStream.Message,
      typeOfResponse.None,
      "production",
    );
    console.log("Testing GM bot", gmBotAddress);
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

      expect(convo).toBeDefined();
      console.log("convo", convo.id);
      const result = await verifyDmStream(
        [workers.getCreator()],
        gmBotAddress,
        "hi",
      );
      expect(result.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should respond to a message", async () => {
    try {
      await xmtpTester.startPage();
      await xmtpTester.newDmFromUI(gmBotAddress);
      await xmtpTester.sendMessage("hi");
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (error) {
      await xmtpTester.takeSnapshot("gm-dm");
      logError(error, gmBotAddress);
      throw error;
    }
  });
  it("should create a group and send a message", async () => {
    try {
      await xmtpTester.newGroupFromUI([...getInboxIds(4), gmBotAddress]);
      await xmtpTester.sendMessage("hi");
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("gm-group");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
