import { sleep } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds, getRandomInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
describe(testName, () => {
  setupTestLifecycle({ testName });
  let groupId: string;
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let xmtpChat: Worker;
  let receiver: Worker;

  beforeAll(async () => {
    const convoStreamBot = await getWorkers(2);
    const names = convoStreamBot.getAll().map((w) => w.name);
    // Start conversation streams for group event detection
    convoStreamBot.startStream(typeofStream.Conversation);

    const gmBotWorker = await getWorkers(1);
    // Start message and response streams for gm bot
    gmBotWorker.startStream(typeofStream.MessageandResponse);

    creator = convoStreamBot.get(names[0]) as Worker;
    xmtpChat = convoStreamBot.get(names[1]) as Worker;
    receiver = gmBotWorker.getCreator();
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
  });

  it("conversation stream without message", async () => {
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
  });

  it("newDm and message stream", async () => {
    await xmtpTester.newDmFromUI(receiver.address);
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
  });

  it("newGroup and message stream", async () => {
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxIds(4),
      receiver.inboxId,
    ]);
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
  });

  it("conversation stream when creating the group", async () => {
    await xmtpTester.newGroupFromUI(
      [...getInboxIds(4), creator.inboxId],
      false,
    );
    const conversationStream = creator.client.conversations.stream();
    for await (const conversation of conversationStream) {
      console.log("conversation found", conversation);
      expect(conversation?.id).toBeDefined();
      break;
    }
  }, 5000);

  it("conversation stream for new member", async () => {
    const groupId = await xmtpTester.newGroupFromUI([...getInboxIds(4)]);
    await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
    const conversationStream = creator.client.conversations.stream();
    for await (const conversation of conversationStream) {
      console.log("conversation found", conversation);
      if (conversation?.id === groupId) {
        expect(conversation.id).toBe(groupId);
        break;
      }
    }
  }, 5000);

  it("new installation and message stream", async () => {
    const xmtpNewTester = new playwright({
      headless,
    });

    await xmtpNewTester.startPage();

    await xmtpNewTester.newDmFromUI(receiver.address);
    await xmtpNewTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpNewTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
  });
});
