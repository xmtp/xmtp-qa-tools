import { loadEnv } from "@helpers/client";
import {
  addMemberByWorker,
  getOrCreateGroup,
  sendMessageWithCount,
} from "@helpers/groups";
import {
  getWorkerConfigs,
  randomDescriptionUpdate,
  randomlyAsignAdmins,
  randomNameUpdate,
  randomSyncs,
  removeMemberByWorker,
} from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  versions: ["100", "105", "202", "203"],
  workerNames: [
    "bob",
    "alice",
    "ivy",
    "dave",
    "eve",
    "frank",
    "grace",
    "heidi",
    "ivan",
    "julia",
  ],
  creator: "fabri",
  installationNames: ["a", "b"],
  manualUsers: {
    convos: "83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208",
    cbWallet:
      "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
    xmtpchat:
      "4382c5142373a8fa5ad16f4a3bf03f9ad07d2a6ac1e3cd271998e53505456996",
  },
  workers: undefined as WorkerManager | undefined,
  groupId: undefined as string | undefined,
};

describe(TEST_NAME, () => {
  // Test state
  let globalGroup: Group | undefined;
  let messageCount = 0;
  let creator: Worker | undefined;
  let rootWorker: WorkerManager | undefined;
  const workerConfigs = getWorkerConfigs(testConfig);

  // Initialize workers and create group
  it("should initialize all workers at once and create group", async () => {
    // Initialize root worker (fabri)
    rootWorker = await getWorkers([testConfig.creator], TEST_NAME, "message");
    creator = rootWorker.getWorkers()[0];

    // Initialize other workers
    testConfig.workers = await getWorkers(workerConfigs, TEST_NAME, "none");

    // Create or get group
    globalGroup = (await getOrCreateGroup(testConfig, creator.client)) as Group;
    testConfig.groupId = globalGroup.id;
    await globalGroup.updateName(globalGroup.id);

    // Send initial message from fabri
    messageCount = await sendMessageWithCount(
      creator,
      globalGroup?.id,
      messageCount,
    );

    // Validate state
    if (!globalGroup?.id || !creator) {
      throw new Error("Group or creator not found");
    }
  });

  // Test message sending and group management
  it("should send messages to group and manage members", async () => {
    // Validate initial state
    if (!globalGroup?.id || !creator || !testConfig.workers) {
      throw new Error("Group or creator not found");
    }
    // Get all workers
    const allWorkers = testConfig.workers?.getWorkers();
    if (allWorkers.length !== 10) {
      throw new Error(`Expected 10 workers but got ${allWorkers.length}`);
    }

    const [bob, alice, ivy, dave, eve, frank, grace, heidi, ivan, julia] =
      allWorkers;

    // Verify all workers are initialized correctly
    for (const worker of allWorkers) {
      if (!worker.client.inboxId) {
        throw new Error(`Worker ${worker.name} not properly initialized`);
      }
    }

    // Update group name
    await globalGroup.updateName(globalGroup.id);

    //await randomReinstall(testConfig.workers);

    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    // Phase 1: Add first batch of workers to the group (bob, alice, dave)
    // Add bob to group
    await addMemberByWorker(globalGroup.id, bob.client.inboxId, creator);

    // Bob sends message
    messageCount = await sendMessageWithCount(
      bob,
      globalGroup.id,
      messageCount,
    );

    // Bob adds alice and dave
    await addMemberByWorker(globalGroup.id, alice.client.inboxId, bob);
    await addMemberByWorker(globalGroup.id, dave.client.inboxId, bob);

    // Alice and Dave send messages
    messageCount = await sendMessageWithCount(
      alice,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      dave,
      globalGroup.id,
      messageCount,
    );

    // Add manual user to group
    await addMemberByWorker(
      globalGroup.id,
      testConfig.manualUsers.xmtpchat,
      bob,
    );

    // Randomly assign admins
    await randomlyAsignAdmins(globalGroup);

    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    // Phase 2: Add eve, frank, and grace
    await addMemberByWorker(globalGroup.id, eve.client.inboxId, alice);
    await addMemberByWorker(globalGroup.id, frank.client.inboxId, dave);
    await addMemberByWorker(globalGroup.id, grace.client.inboxId, bob);

    // New members send messages
    messageCount = await sendMessageWithCount(
      eve,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      frank,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      grace,
      globalGroup.id,
      messageCount,
    );

    // Add manual user to group
    await addMemberByWorker(
      globalGroup.id,
      testConfig.manualUsers.convos,
      alice,
    );
    // Add manual user to group
    await addMemberByWorker(
      globalGroup.id,
      testConfig.manualUsers.cbWallet,
      alice,
    );

    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    // Phase 3: Add heidi, ivan, julia, and add ivy
    await addMemberByWorker(globalGroup.id, heidi.client.inboxId, frank);
    await addMemberByWorker(globalGroup.id, ivan.client.inboxId, grace);
    await addMemberByWorker(globalGroup.id, julia.client.inboxId, eve);

    // Add ivy who was initialized but not yet added
    await addMemberByWorker(globalGroup.id, ivy.client.inboxId, bob);

    // Newly added workers send messages
    messageCount = await sendMessageWithCount(
      heidi,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      ivan,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      julia,
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      ivy,
      globalGroup.id,
      messageCount,
    );

    // Randomly assign admins again
    await randomlyAsignAdmins(globalGroup);

    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    // Phase 4: Remove members
    await removeMemberByWorker(globalGroup.id, dave.client.inboxId, alice);
    await removeMemberByWorker(globalGroup.id, frank.client.inboxId, bob);

    await randomNameUpdate(globalGroup, testConfig.workers);
    await randomDescriptionUpdate(globalGroup, testConfig.workers);

    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    // Final sync
    await randomSyncs({
      workers: testConfig.workers,
      groupId: testConfig.groupId as string,
    });

    console.log(`Total message count: ${messageCount}`);
  });
});
