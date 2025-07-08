import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

const testName = "failtowait";

describe(testName, () => {
  // Get 100 inbox IDs for group members
  const memberInboxIds = getInboxIds(100);
  it("should create a group with 100 members in sdk 2.0.9", async () => {
    const workers = await getWorkers(1, {
      nodeVersion: "2.0.9",
    });
    const creator = workers.getAll()[0];
    console.log(`Creating group with ${memberInboxIds.length} members`);

    // Create the group
    const group = (await creator.client.conversations.newGroup(
      memberInboxIds,
    )) as Group;
    await group.sync();
    console.log(`Group created with ID: ${group.id}`);
  });
  it("should create a group with 100 members in sdk 3.0.1", async () => {
    const workers = await getWorkers(1, {
      nodeVersion: "3.0.1",
    });
    const creator = workers.getAll()[0];
    console.log(`Creating group with ${memberInboxIds.length} members`);

    // Create the group
    const group = (await creator.client.conversations.newGroup(
      memberInboxIds,
    )) as Group;
    await group.sync();
    console.log(`Group created with ID: ${group.id}`);
  });
  it("should create a group with 100 members in sdk 3.1.0-dev", async () => {
    const workers = await getWorkers(1, {
      nodeVersion: "3.1.0",
    });
    const creator = workers.getAll()[0];
    console.log(`Creating group with ${memberInboxIds.length} members`);

    // Create the group
    const group = (await creator.client.conversations.newGroup(
      memberInboxIds,
    )) as Group;
    await group.sync();
    console.log(`Group created with ID: ${group.id}`);
  });
});
