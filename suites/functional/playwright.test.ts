import { sleep } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds, getRandomInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "playwright";
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
    if (!result) {
      await xmtpTester.takeSnapshot("group-invite-with-message");
    }
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
    if (!result) {
      await xmtpTester.takeSnapshot("group-invite-without-message");
    }
  });

  it("newDm and message stream", async () => {
    await xmtpTester.newDmFromUI(receiver.address);
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
    if (!result) {
      await xmtpTester.takeSnapshot("dm-creation-and-response");
    }
  });

  it("newGroup and message stream", async () => {
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxIds(4),
      receiver.inboxId,
    ]);
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
    if (!result) {
      await xmtpTester.takeSnapshot("group-creation-via-ui");
    }
  });

  it("conversation stream for new member", async () => {
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
    await xmtpTester.takeSnapshot("async-member-addition");
  });

  it("new installation and message stream", async () => {
    const xmtpNewTester = new playwright({
      headless,
    });

    await xmtpNewTester.startPage();

    await xmtpNewTester.newDmFromUI(receiver.address);
    await xmtpNewTester.sendMessage(`hi ${receiver.name}`);
    const result = await xmtpNewTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
    await xmtpNewTester.takeSnapshot("multi-instance-messaging");
  });
});
