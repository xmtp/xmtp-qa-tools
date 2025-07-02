import { getManualUsers } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("bug_addmember", async () => {
  const workers = await getWorkers(["bob"]);
  const receiverWorkers = await getWorkers(["alice"]);

  let creator = workers.get("bob")!;
  let receiver = receiverWorkers.get("alice")!;

  let group: Group;

  setupTestLifecycle({});

  it("should create a group", async () => {
    const allInboxIds = [
      ...getInboxIds(1),
      ...getManualUsers(["fabri-xmtpchat"]).map((u) => u.inboxId),
    ];
    console.log("All inbox ids", allInboxIds);
    group = (await creator.client.conversations.newGroup(allInboxIds)) as Group;
    console.log("Group created", group.id);
    await group.send("Debug message");

    console.log(
      "Add this member in xmtpchat group t see the conversation stream",
    );
    await group.send(receiver.inboxId);
    console.log(receiver.inboxId);
    const stream = receiver.client.conversations.stream();
    for await (const conversation of stream) {
      if (conversation?.id === group.id) {
        console.log("Conversation", conversation.id);
        expect(conversation.id).toBe(group.id);
        break;
      }
    }
  });
});
