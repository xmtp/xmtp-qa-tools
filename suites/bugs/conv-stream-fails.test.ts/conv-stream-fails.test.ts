import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "browser";
describe(testName, () => {
  setupTestLifecycle({ testName });
  const headless = false;
  let xmtpTester: playwright;
  let creator: Worker;
  let xmtpChat: Worker;

  beforeAll(async () => {
    const convoStreamBot = await getWorkers(["randomgroup", "randommember"]);
    const names = convoStreamBot.getAll().map((w) => w.name);
    // Start conversation streams for group event detection
    convoStreamBot.startStream(typeofStream.Conversation);

    creator = convoStreamBot.get(names[0]) as Worker;
    xmtpChat = convoStreamBot.get(names[1]) as Worker;
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
});
