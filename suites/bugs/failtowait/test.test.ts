import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

const testName = "failtowait";

describe(testName, async () => {
  const workers = await getWorkers(1, {
    nodeVersion: "3.1.0",
  });
  const creator = workers.getAll()[0];

  it("should create a group with 50 members", async () => {
    // Get 100 inbox IDs for group members
    const memberInboxIds = getInboxIds(50);
    console.log(`Creating group with ${memberInboxIds.length} members`);

    // Create the group
    const group = (await creator.client.conversations.newGroup(
      memberInboxIds,
    )) as Group;
    await group.sync();

    console.log(`Group created with ID: ${group.id}`);
  });

  it("should create a group with 100 members", async () => {
    // Get 100 inbox IDs for group members
    const memberInboxIds = getInboxIds(100);
    console.log(`Creating group with ${memberInboxIds.length} members`);

    // Create the group
    const group = (await creator.client.conversations.newGroup(
      memberInboxIds,
    )) as Group;
    await group.sync();
    console.log(`Group created with ID: ${group.id}`);
  });
});
