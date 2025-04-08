import { loadEnv } from "@helpers/client";
import {
  addMemberByWorker,
  createRandomInstallations,
  getOrCreateGroup,
  getWorkerConfigs,
  randomlyAsignAdmins,
  randomSyncs,
  removeMember,
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
    convos: "f8a453b9708a2ff98791d35eb56a91a46f7722c2684868c7f37c74ece57af276",
    xmtpchat:
      "a867afb928842d104f7e0f64311398723875ea73c3525399e88bb9f7aa4622f4",
  },
  workers: undefined as WorkerManager | undefined,
  enableNetworkConditions: false,
  enableRandomSyncs: true,
  randomlyAsignAdmins: true,
  removeMembers: true,
  createRandomInstallations: false,
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
    if (testConfig.createRandomInstallations) {
      bobWorker = (await createRandomInstallations(2, bob)) as Worker;
    }

    if (testConfig.enableNetworkConditions && testConfig.workers) {
      setRandomNetworkConditions(testConfig.workers);
    }

    if (
      testConfig.enableRandomSyncs &&
      testConfig.workers &&
      testConfig.groupId
    ) {
      await randomSyncs({
        workers: testConfig.workers,
        groupId: testConfig.groupId,
      });
    }

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

    // Remove ivy if configured
    if (testConfig.removeMembers) {
      await removeMember(globalGroup, ivy);
    }

    // Random syncs if enabled
    if (
      testConfig.enableRandomSyncs &&
      testConfig.workers &&
      testConfig.groupId
    ) {
      await randomSyncs({
        workers: testConfig.workers,
        groupId: testConfig.groupId,
      });
    }

    // Alice sends another message
    messageCount = await sendMessageWithCount(
      alice,
      globalGroup.id,
      messageCount,
    );
    console.log(`${alice?.name} sent ${messageCount} messages`);

    // Random syncs if enabled
    if (
      testConfig.enableRandomSyncs &&
      testConfig.workers &&
      testConfig.groupId
    ) {
      await randomSyncs({
        workers: testConfig.workers,
        groupId: testConfig.groupId,
      });
    }

    // Bob sends another message
    messageCount = await sendMessageWithCount(
      bobWorker,
      globalGroup.id,
      messageCount,
    );

    // Randomly assign admins if enabled
    if (testConfig.randomlyAsignAdmins) {
      await randomlyAsignAdmins(globalGroup);
    }

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
