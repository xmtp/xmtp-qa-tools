import { getRandomNames, sleep } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds, getRandomInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";

describe(testName, () => {
  let groupId: string;
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let xmtpChat: Worker;
  let receiver: Worker;
  const names = getRandomNames(3);

  setupTestLifecycle({
    testName,
    expect,
  });
  beforeAll(async () => {
    const convoStreamBot = await getWorkers(
      [names[0], names[1]],
      testName,
      typeofStream.Conversation,
    );
    const gmBotWorker = await getWorkers(
      [names[2]],
      testName,
      typeofStream.Message,
      typeOfResponse.Gm,
    );
    creator = convoStreamBot.get(names[0]) as Worker;
    xmtpChat = convoStreamBot.get(names[1]) as Worker;
    receiver = gmBotWorker.get(names[2]) as Worker;
    console.log(names[1], xmtpChat.inboxId, xmtpChat.name);
    xmtpTester = new playwright({
      headless,
      defaultUser: {
        inboxId: xmtpChat.inboxId,
        dbEncryptionKey: xmtpChat.encryptionKey,
        walletKey: xmtpChat.walletKey,
        accountAddress: xmtpChat.address,
      },
    });
    await xmtpTester.startPage();
  });

  it("conversation stream with message", async () => {
    try {
      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
        {
          groupName: "Test Group 1 " + getTime(),
        },
      );
      await sleep(1000);
      await newGroup.addMembers([xmtpChat.inboxId]);
      await newGroup.send(`hi ${receiver.name}`);
      const result = await xmtpTester.waitForNewConversation(newGroup.name);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-invite-with-message");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("conversation stream without message", async () => {
    try {
      const newGroup = await creator.client.conversations.newGroup(
        getRandomInboxIds(4),
        {
          groupName: "Test Group 2 " + getTime(),
        },
      );
      await sleep(1000);
      await newGroup.addMembers([xmtpChat.inboxId]);
      const result = await xmtpTester.waitForNewConversation(newGroup.name);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-invite-without-message");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("newDm and message stream", async () => {
    try {
      await xmtpTester.newDmFromUI(receiver.address);
      await xmtpTester.sendMessage(`hi ${receiver.name}`);
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("dm-creation-and-response");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("newGroup and message stream", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        receiver.inboxId,
      ]);
      await xmtpTester.sendMessage(`hi ${receiver.name}`);
      const result = await xmtpTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpTester.takeSnapshot("group-creation-via-ui");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("conversation stream for new member", async () => {
    try {
      groupId = await xmtpTester.newGroupFromUI([
        ...getInboxIds(4),
        receiver.inboxId,
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
      await xmtpTester.takeSnapshot("async-member-addition");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("new installation and message stream", async () => {
    const xmtpNewTester = new playwright({
      headless,
    });
    try {
      await xmtpNewTester.startPage();

      await xmtpNewTester.newDmFromUI(receiver.address);
      await xmtpNewTester.sendMessage(`hi ${receiver.name}`);
      const result = await xmtpNewTester.waitForResponse(["gm"]);
      expect(result).toBe(true);
    } catch (e) {
      await xmtpNewTester.takeSnapshot("multi-instance-messaging");
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
