import { loadEnv } from "@helpers/client";
import {
  addMemberByWorker,
  createRandomInstallations,
  getOrCreateGroup,
  getWorkerConfigs,
  randomlyAsignAdmins,
  randomSyncs,
  removeMemberByWorker,
  sendMessageWithCount,
  setRandomNetworkConditions,
} from "@helpers/tests";
import type { Worker, WorkerManager } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  versions: ["100", "104", "105"],
  workerNames: ["bob", "alice", "ivy"],
  workerIds: ["a", "device", "device2"],
  manualUsers: {
    convos: "28eab5603e3b8935c6c4209b4beedb0d54f7abd712fc86f8dc23b2617e28c284",
    xmtpchat:
      "20163dfde797c8a9ec05991c062a1904b89dc1fe82c6fc27972fd1f46044088d",
  },
  workers: undefined as WorkerManager | undefined,
  rootWorker: "fabri",
  groupId: undefined as string | undefined,
};

describe(TEST_NAME, () => {
  // Test state
  let globalGroup: Group | undefined;
  let messageCount = 0;
  let fabri: Worker | undefined;
  let rootWorker: WorkerManager | undefined;
  const workerConfigs = getWorkerConfigs(testConfig);

  // Initialize workers and create group
  it("should initialize all workers at once and create group", async () => {
    // Initialize root worker (fabri)
    rootWorker = await getWorkers(
      [testConfig.rootWorker],
      TEST_NAME,
      "message",
    );
    fabri = rootWorker.getWorkers()[0];

    // Initialize other workers
    testConfig.workers = await getWorkers(workerConfigs, TEST_NAME, "none");

    // Create or get group
    globalGroup = (await getOrCreateGroup(testConfig, fabri.client)) as Group;
    testConfig.groupId = globalGroup.id;
    await globalGroup.updateName(globalGroup.id);

    // Send initial message
    messageCount = await sendMessageWithCount(
      fabri,
      globalGroup?.id,
      messageCount,
    );

    // Validate state
    if (!globalGroup?.id || !fabri) {
      throw new Error("Group or fabri not found");
    }
    setRandomNetworkConditions(testConfig.workers);
  });

  // Test message sending and group management
  it("should send messages to group and manage members", async () => {
    // Validate initial state
    if (!globalGroup?.id || !fabri) {
      throw new Error("Group or fabri not found");
    }

    // Get workers
    const bob = testConfig.workers?.getWorkers()[0] as Worker;
    const alice = testConfig.workers?.getWorkers()[1] as Worker;
    const ivy = testConfig.workers?.getWorkers()[2] as Worker;

    if (!bob.client.inboxId || !alice.client.inboxId || !ivy.client.inboxId) {
      throw new Error("Worker not found");
    }
    // Update group name
    await globalGroup.updateName(globalGroup.id);

    // Apply test configurations
    let bobWorker = bob;

    await randomSyncs({
      workers: testConfig.workers as WorkerManager,
      groupId: testConfig.groupId as string,
    });

    // Add bob to group
    await addMemberByWorker(globalGroup.id, bobWorker?.client.inboxId, fabri);

    // Add manual user to group
    await addMemberByWorker(
      globalGroup.id,
      testConfig.manualUsers.xmtpchat,
      bobWorker,
    );

    // Add manual user to group
    await addMemberByWorker(
      globalGroup.id,
      testConfig.manualUsers.convos,
      bobWorker,
    );
    // Bob sends message
    messageCount = await sendMessageWithCount(
      bobWorker,
      globalGroup.id,
      messageCount,
    );
    await globalGroup.updateName(globalGroup.id);

    // Add alice to group
    await addMemberByWorker(globalGroup.id, alice?.client.inboxId, bobWorker);

    // Alice sends message
    messageCount = await sendMessageWithCount(
      alice,
      globalGroup.id,
      messageCount,
    );

    // Randomly assign admins
    await randomlyAsignAdmins(globalGroup);

    await removeMemberByWorker(globalGroup.id, ivy?.client.inboxId, bobWorker);

    await randomSyncs({
      workers: testConfig.workers as WorkerManager,
      groupId: testConfig.groupId as string,
    });

    // Alice sends another message
    messageCount = await sendMessageWithCount(
      alice,
      globalGroup.id,
      messageCount,
    );

    await randomSyncs({
      workers: testConfig.workers as WorkerManager,
      groupId: testConfig.groupId as string,
    });

    // Bob sends another message
    messageCount = await sendMessageWithCount(
      bobWorker,
      globalGroup.id,
      messageCount,
    );

    await randomlyAsignAdmins(globalGroup);

    // Add ivy to group
    await addMemberByWorker(globalGroup.id, ivy?.client.inboxId, bobWorker);

    // Ivy sends message
    messageCount = await sendMessageWithCount(
      ivy,
      globalGroup.id,
      messageCount,
    );
  });
});
