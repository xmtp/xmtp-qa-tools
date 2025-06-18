import { sleep } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds, getRandomInbox, getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "playwright";

describe(testName, () => {
  let groupId: string;
  const receiver = "random";
  const headless = true;
  let xmtpTester: playwright;
  let creator: Worker;
  let gmBot: Worker;

  setupTestLifecycle({
    testName,
    expect,
  });

  const inbox = getRandomInbox();
  beforeAll(async () => {
    xmtpTester = new playwright({
      headless,
      defaultUser: inbox,
    });
    await xmtpTester.startPage();
    const convoStreamBot = await getWorkers(
      ["bob"],
      testName,
      typeofStream.Conversation,
    );
    const gmBotWorker = await getWorkers(
      [receiver],
      testName,
      typeofStream.Message,
      typeOfResponse.Gm,
    );

    creator = convoStreamBot.get("bob") as Worker;
    gmBot = gmBotWorker.get(receiver) as Worker;
  });

  it("should detect group invitation in browser when invitation includes an initial message", async () => {
    try {
      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
        {
          groupName: "Test Group 1 " + getTime(),
        },
      );
      await sleep(1000);
      await newGroup.addMembers([inbox.inboxId]);
      await newGroup.send(`hi ${receiver}`);
      const result = await xmtpTester.waitForNewConversation(newGroup.name);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-invite-with-message");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should detect group invitation in browser when invitation has no accompanying message", async () => {
    try {
      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
        {
          groupName: "Test Group 2 " + getTime(),
        },
      );
      await sleep(1000);
      await newGroup.addMembers([inbox.inboxId]);
      const result = await xmtpTester.waitForNewConversation(newGroup.name);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-invite-without-message");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create DM via browser UI and receive automated GM bot response", async () => {
    try {
      await xmtpTester.newDmFromUI(gmBot.address);
      await xmtpTester.sendMessage(`hi ${receiver}`);
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("dm-creation-gm-response");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should create group via browser UI and validate GM bot messaging functionality", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        gmBot.inboxId,
      ]);
      await xmtpTester.sendMessage(`hi ${receiver}`);
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-creation-gm-response");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should stream real-time group updates when members are added using async iterator pattern", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        gmBot.inboxId,
      ]);
      await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
      const conversationStream = await creator.client.conversations.stream();
      for await (const conversation of conversationStream) {
        if (conversation?.id === groupId) {
          expect(conversation.id).toBe(groupId);
          break;
        }
      }
    } catch (e) {
      await xmtpTester.takeSnapshot("async-iterator-member-addition");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should stream real-time group updates when members are added using callback pattern", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        gmBot.inboxId,
      ]);
      await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
      creator.client.conversations.stream((err, conversation) => {
        if (err) {
          logError(err, expect.getState().currentTestName);
          throw err;
        }
        if (conversation?.id) {
          console.log("conversation", conversation.id);
          expect(conversation.id).toBe(groupId);
        }
      });
    } catch (e) {
      await xmtpTester.takeSnapshot("callback-pattern-member-addition");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("should handle multiple browser instances with independent messaging sessions", async () => {
    const xmtpNewTester = new playwright({
      headless,
    });
    try {
      await xmtpNewTester.startPage();

      await xmtpNewTester.newDmFromUI(gmBot.address);
      await xmtpNewTester.sendMessage(`hi ${receiver}`);
      const result = await xmtpNewTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpNewTester.takeSnapshot("multi-instance-independent-sessions");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
