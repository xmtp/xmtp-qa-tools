import { sleep } from "@helpers/client";
import { getTime } from "@helpers/logger";
import { sendTextCompat } from "@helpers/sdk-compat";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
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
      getInboxes(4).map((a) => a.inboxId),
      {
        groupName: "Test Group 1 " + getTime(),
      },
    );
    await sleep();
    await newGroup.addMembers([xmtpChat.inboxId]);
    await sendTextCompat(newGroup, `hi ${receiver.name}`);
    console.log("waiting for new conversation");
    const result = await xmtpTester.waitForNewConversation(newGroup.name);
    console.log("new conversation found", result);
    expect(result).toBe(true);
  });

  it("conversation stream without message", async () => {
    const newGroup = await creator.client.conversations.newGroup(
      getInboxes(4).map((a) => a.inboxId),
      {
        groupName: "Test Group 2 " + getTime(),
      },
    );
    await sleep();
    await newGroup.addMembers([xmtpChat.inboxId]);
    console.log("waiting for new conversation");
    const result = await xmtpTester.waitForNewConversation(newGroup.name);
    expect(result).toBe(true);
  });

  // it("newDm and message stream", async () => {
  //   await sleep();
  //   await xmtpTester.newDmFromUI(receiver.address);
  //   await xmtpTester.sendMessage(`hi ${receiver.name}`);
  //   console.log("waiting for response");
  //   const result = await xmtpTester.waitForResponse(["gm"]);
  //   console.log("response received", result);
  //   expect(result).toBe(true);
  // });

  it("newGroup and message stream", async () => {
    await sleep();
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxes(4).map((a) => a.inboxId),
      receiver.inboxId,
    ]);
    await sleep(); // Give time for group creation to sync
    await xmtpTester.sendMessage(`hi ${receiver.name}`);
    console.log("waiting for response");
    const result = await xmtpTester.waitForResponse(["gm"]);
    console.log("response received", result);
    expect(result).toBe(true);
  });

  it("conversation stream when creating the group", async () => {
    const conversationStream = creator.client.conversations.stream();
    groupId = await xmtpTester.newGroupFromUI(
      [...getInboxes(4).map((a) => a.inboxId), creator.inboxId],
      false,
    );
    await sleep(); // Give time for group creation to sync
    for await (const conversation of await conversationStream) {
      if (conversation?.id === groupId) {
        console.log("conversation found", conversation?.id);
        expect(conversation.id).toBe(groupId);
        break;
      }
      break;
    }
  }, 30000);

  it("conversation stream for new member", async () => {
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxes(4).map((a) => a.inboxId),
    ]);
    await sleep(); // Give time for group creation to sync
    const conversationStream = creator.client.conversations.stream();
    await xmtpTester.addMemberToGroup(groupId, creator.inboxId);
    await sleep(); // Give time for member addition to sync
    for await (const conversation of await conversationStream) {
      if (conversation?.id === groupId) {
        console.log("conversation found", conversation?.id);
        expect(conversation.id).toBe(groupId);
        break;
      }
    }
  }, 30000);
});


