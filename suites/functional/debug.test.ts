import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "debug";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(3);
  let group: Group;

  it("debug: retrieve group debug information", async () => {
    group = await workers.createGroupBetweenAll();

    // Get debug info
    const debugInfo = await group.debugInfo();

    // Verify debug info structure
    expect(debugInfo).toBeDefined();
    expect(debugInfo.epoch).toBeDefined();
    expect(typeof debugInfo.epoch).toBe("bigint");
    expect(debugInfo.epoch).toBeGreaterThan(0n);

    // Verify fork detection
    expect(debugInfo.maybeForked).toBeDefined();
    expect(typeof debugInfo.maybeForked).toBe("boolean");
  });

  it("debug: track epoch changes during group operations", async () => {
    const initialDebugInfo = await group.debugInfo();
    const initialEpoch = initialDebugInfo.epoch;

    // Perform group operation that should increment epoch
    const newMember = getInboxIds(1)[0];
    await group.addMembers([newMember]);
    // Get updated debug info
    const updatedDebugInfo = await group.debugInfo();
    const updatedEpoch = updatedDebugInfo.epoch;

    // Verify epoch increased
    expect(updatedEpoch).toBe(initialEpoch + 1n);
  });

  it("debug: verify epoch consistency across members", async () => {
    // Get debug info from all members
    const debugInfos = await Promise.all(
      workers.getAll().map(async (worker) => {
        await worker.client.conversations.sync();
        const memberGroup =
          await worker.client.conversations.getConversationById(group.id);
        await (memberGroup as Group).sync();
        expect(memberGroup).toBeDefined();
        return await (memberGroup as Group).debugInfo();
      }),
    );

    // Verify all members have the same epoch
    const firstEpoch = debugInfos[0].epoch;
    for (const debugInfo of debugInfos) {
      expect(debugInfo.epoch).toBe(firstEpoch);
    }
  });

  it("debug: detect potential forks in group state", async () => {
    // Get debug info from all members
    const debugInfos = await Promise.all(
      workers.getAll().map(async (worker) => {
        await worker.client.conversations.sync();
        const memberGroup =
          await worker.client.conversations.getConversationById(group.id);
        expect(memberGroup).toBeDefined();
        return await (memberGroup as Group).debugInfo();
      }),
    );

    // Check for fork detection
    for (const debugInfo of debugInfos) {
      // In normal operation, should not be forked
      expect(debugInfo.maybeForked).toBe(false);
    }
  });

  it("debug: verify debug info after metadata changes", async () => {
    const debugInfoBefore = await group.debugInfo();

    // Update metadata
    await group.updateName("Debug Test Name");
    const debugInfoAfterName = await group.debugInfo();
    expect(debugInfoAfterName.epoch).toBeGreaterThan(debugInfoBefore.epoch);

    // Update description
    await group.updateDescription("Debug test description");
    const debugInfoAfterDesc = await group.debugInfo();
    expect(debugInfoAfterDesc.epoch).toBeGreaterThan(debugInfoAfterName.epoch);
  });

  it("debug: verify debug info structure completeness", async () => {
    const debugInfo = await group.debugInfo();

    // Verify all expected properties exist
    expect(debugInfo).toHaveProperty("epoch");
    expect(debugInfo).toHaveProperty("maybeForked");

    // Verify epoch is a positive bigint
    expect(debugInfo.epoch).toBeGreaterThan(0n);
    expect(typeof debugInfo.epoch).toBe("bigint");

    // Verify maybeForked is boolean
    expect(typeof debugInfo.maybeForked).toBe("boolean");
  });
});
