import { getInboxes } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@helpers/versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, () => {
  it("create a group", async () => {
    const workers = await getWorkers(["henry", "john"]);
    const creator = workers.get("henry")!;
    const receiver = workers.get("john")!;
    const allInboxIds = getInboxes(2).map((a) => a.inboxId);
    console.log("All inbox ids", allInboxIds);
    const group = (await creator.client.conversations.newGroup(
      allInboxIds,
    )) as Group;

    await group.send(receiver.inboxId);
    await receiver.client.conversations.syncAll();
    const stream = receiver.client.conversations.stream();
    await group.addMembers([receiver.client.inboxId]);
    for await (const conversation of await stream) {
      console.log("Conversation", conversation?.id);
      expect(conversation?.id).toBe(group.id);
      break;
    }
  });
});
