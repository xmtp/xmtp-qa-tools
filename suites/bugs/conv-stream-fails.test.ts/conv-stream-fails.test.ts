import { playwright } from "@helpers/playwright";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeofStream } from "@workers/main";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, it } from "vitest";

const testName = "welcome";
describe(testName, async () => {
  let groupId: string;
  const headless = false;
  let xmtpTester: playwright;
  let xmtpChat: Worker;
  let creator: Worker;

  const convoStreamBot = await getWorkers(2);
  const names = convoStreamBot.getAll().map((w) => w.name);
  convoStreamBot.startStream(typeofStream.Conversation);

  creator = convoStreamBot.get(names[0]) as Worker;
  xmtpChat = convoStreamBot.get(names[1]) as Worker;
  xmtpTester = new playwright({
    headless,
  });
  await xmtpTester.startPage();

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
      console.log("conversation found", conversation);
      break;
    }
  }, 10000);

  it("conversation stream adding it as member", async () => {
    const conversationStream = await creator.client.conversations.stream();
    groupId = await xmtpTester.newGroupFromUI([...getInboxIds(4)]);
    await xmtpTester.addMemberToGroup(groupId, creator.inboxId);

    for await (const conversation of conversationStream) {
      console.log("conversation found", conversation);
    }
  }, 10000);
});
