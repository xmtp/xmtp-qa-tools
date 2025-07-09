import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "welcome";
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

  it("conversation stream adding it as member", async () => {
    const conversationStream = await creator.client.conversations.stream();
    groupId = await xmtpTester.newGroupFromUI([
      ...getInboxIds(4),
      receiver.inboxId,
    ]);
    await xmtpTester.addMemberToGroup(groupId, creator.inboxId);

    for await (const conversation of conversationStream) {
      console.log("conversation", conversation?.id);
      expect(conversation?.id).toBeDefined();
      break;
    }
  }, 10000);

  it("conversation stream when creating the group", async () => {
    const conversationStream = await creator.client.conversations.stream();
    await xmtpTester.page?.goto("https://xmtp.chat/conversations/new-group");
    await xmtpTester.page?.getByRole("button", { name: "Members" }).click();

    const addressInput = xmtpTester.page?.getByRole("textbox", {
      name: "Address",
    });
    for (const address of [...getInboxIds(4), creator.inboxId]) {
      await addressInput?.fill(address);
      await xmtpTester.page?.getByRole("button", { name: "Add" }).click();
    }

    await xmtpTester.page?.getByRole("button", { name: "Create" }).click();
    for await (const conversation of conversationStream) {
      console.log("conversation", conversation?.id);
      expect(conversation?.id).toBeDefined();
      break;
    }
  }, 10000);
});
