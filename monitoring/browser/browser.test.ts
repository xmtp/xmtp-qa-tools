import { sleep, streamTimeout } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxIds, getRandomInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";
import { playwright } from "./playwright";

const testName = "browser";
describe(testName, () => {
  setupDurationTracking({ testName });
  let groupId: string;
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let xmtpChat: Worker;
  let receiver: Worker;

  beforeAll(async () => {
    const convoStreamBot = await getWorkers(2);
    // Start conversation streams for group event detection
    convoStreamBot.startStream(typeofStream.Conversation);

    const gmBotWorker = await getWorkers(1);
    // Start message and response streams for gm bot
    gmBotWorker.startStream(typeofStream.MessageandResponse);

    creator = convoStreamBot.get(0)!;
    xmtpChat = convoStreamBot.get(1)!;
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
    console.log("waiting for new conversation");
    const result = await xmtpTester.waitForNewConversation(newGroup.name);
    console.log("new conversation found", result);
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
    console.log("waiting for new conversation");
    const result = await xmtpTester.waitForNewConversation(newGroup.name);
    expect(result).toBe(true);
  });

  it("newDm and message stream", async () => {
    await sleep(1000);
    await xmtpTester.newDmFromUI(receiver.address);
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    console.log("waiting for response");
    const result = await xmtpTester.waitForResponse(["gm"]);
    console.log("response received", result);
    expect(result).toBe(true);
  });

  it("newGroup and message stream", async () => {
    await sleep(1000);
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxIds(4),
      receiver.inboxId,
    ]);
    await sleep(1000); // Give time for group creation to sync
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    console.log("waiting for response");
    const result = await xmtpTester.waitForResponse(["gm"]);
    console.log("response received", result);
    expect(result).toBe(true);
  });

  it(
    "conversation stream when creating the group",
    async () => {
      await xmtpTester.newGroupFromUI(
        [...getInboxIds(4), creator.inboxId],
        false,
      );
      await sleep(2000); // Give time for group creation to sync
      const conversationStream = creator.client.conversations.stream();
      for await (const conversation of await conversationStream) {
        if (conversation?.id === groupId) {
          console.log("conversation found", conversation?.id);
          expect(conversation.id).toBe(groupId);
          break;
        }
        break;
      }
    },
    streamTimeout,
  );

  it(
    "conversation stream for new member",
    async () => {
      groupId = await xmtpTester.newGroupFromUI([...getInboxIds(4)]);
      await sleep(2000); // Give time for group creation to sync
      await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
      await sleep(2000); // Give time for member addition to sync
      const conversationStream = creator.client.conversations.stream();
      for await (const conversation of await conversationStream) {
        if (conversation?.id === groupId) {
          console.log("conversation found", conversation?.id);
          expect(conversation.id).toBe(groupId);
          break;
        }
      }
    },
    streamTimeout,
  );

  it("new installation and message stream", async () => {
    const xmtpNewTester = new playwright({
      headless,
    });

    await xmtpNewTester.startPage();

    await xmtpNewTester.newDmFromUI(receiver.address);
    await xmtpNewTester.sendMessage(`hi ${receiver.name}`);
    console.log("waiting for response");
    const result = await xmtpNewTester.waitForResponse(["gm"]);
    console.log("response received", result);
    expect(result).toBe(true);
  });
});
