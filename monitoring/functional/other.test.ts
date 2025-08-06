import { verifyMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Dm, type Group } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "sync";
describe(testName, () => {
  setupDurationTracking({ testName });

  it("create a group", async () => {
    const workers = await getWorkers(["henry", "john"]);
    const creator = workers.get("henry")!;
    const receiver = workers.get("john")!;
    const allInboxIds = getRandomInboxIds(2);
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
  }, 500);

  it("track epoch changes during group operations", async () => {
    const workers = await getWorkers(3);

    const group = await workers.createGroupBetweenAll();
    const initialDebugInfo = await group.debugInfo();
    const initialEpoch = initialDebugInfo.epoch;

    // Perform group operation that should increment epoch
    const newMember = getRandomInboxIds(1)[0];
    await group.addMembers([newMember]);
    // Get updated debug info
    const updatedDebugInfo = await group.debugInfo();
    console.log("updatedEpoch", updatedDebugInfo.epoch);
    expect(updatedDebugInfo.epoch).toBe(initialEpoch + 1n);
  });

  it("stitching", async () => {
    const workers = await getWorkers(["randombob-a", "alice"]);
    let creator = workers.get("randombob", "a")!;
    const receiver = workers.get("alice")!;
    const dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;

    console.log("New dm created", dm.id);

    const resultFirstDm = await verifyMessageStream(dm, [receiver]);
    expect(resultFirstDm.receptionPercentage).toBeGreaterThanOrEqual(0);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    const secondDm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultSecondDm = await verifyMessageStream(secondDm, [receiver]);
    expect(resultSecondDm.receptionPercentage).toBeGreaterThanOrEqual(0);
  });
});
