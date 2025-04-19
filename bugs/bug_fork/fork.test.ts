import { loadEnv } from "@helpers/client";
import {
  getOrCreateGroup,
  membershipChange,
  sendMessageWithCount,
} from "@helpers/groups";
import { randomDescriptionUpdate, randomNameUpdate } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

// Test configuration
const TEST_NAME = "bug_fork";
loadEnv(TEST_NAME);

const testConfig = {
  testName: TEST_NAME,
  workerNames: [
    "bob-a-203",
    "alice-a-203",
    "ivy-a-203",
    "dave-a-203",
    "eve-a-203",
    "frank-a-203",
    "grace-a-203",
  ],
  creator: "fabri",
  manualUsers: {
    USER_CONVOS:
      "83fb0946cc3a716293ba9c282543f52050f0639c9574c21d597af8916ec96208",
    USER_CB_WALLET:
      "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
    USER_XMTPCHAT:
      "5d14144ea9bf00296919cf6a3d6bd7ea9b53138ebe177108a35b0ab9ac00900e",
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

  // Initialize workers and create group
  it("should initialize all workers at once and create group", async () => {
    // Initialize root worker (fabri)
    rootWorker = await getWorkers([testConfig.creator], TEST_NAME, "message");
    creator = rootWorker.getWorkers()[0];

    // Initialize other workers
    testConfig.workers = await getWorkers(
      testConfig.workerNames,
      TEST_NAME,
      "none",
    );

    // Create or get group
    globalGroup = (await getOrCreateGroup(testConfig, creator.client, [
      ...testConfig.workers.getWorkers().map((w) => w.client.inboxId),
      ...Object.values(testConfig.manualUsers),
    ])) as Group;
    testConfig.groupId = globalGroup.id;
    await globalGroup.updateName("Fork group");

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

    // Verify all workers are initialized correctly
    for (const worker of allWorkers) {
      if (!worker.client.inboxId) {
        throw new Error(`Worker ${worker.name} not properly initialized`);
      }
    }

    await globalGroup.sync();
    console.log("synced group");
    const members = await globalGroup.members();
    console.log("members", members);

    // Phase 1: Add first batch of workers to the group (bob, alice, dave)

    // Bob adds alice and dave
    await membershipChange(globalGroup.id, creator, allWorkers[0]);
    // Bob sends message
    messageCount = await sendMessageWithCount(
      allWorkers[0],
      globalGroup.id,
      messageCount,
    );

    // Alice and Dave send messages
    messageCount = await sendMessageWithCount(
      allWorkers[1],
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      allWorkers[2],
      globalGroup.id,
      messageCount,
    );

    // Add manual user to group
    await membershipChange(globalGroup.id, creator, allWorkers[3]);
    // Bob sends message
    messageCount = await sendMessageWithCount(
      allWorkers[3],
      globalGroup.id,
      messageCount,
    );

    // Phase 2: Add eve, frank, and grace
    await membershipChange(globalGroup.id, creator, allWorkers[4]);

    // New members send messages
    messageCount = await sendMessageWithCount(
      allWorkers[4],
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      allWorkers[4],
      globalGroup.id,
      messageCount,
    );

    messageCount = await sendMessageWithCount(
      allWorkers[4],
      globalGroup.id,
      messageCount,
    );

    await membershipChange(
      globalGroup.id,
      creator,
      testConfig.workers.getWorkers()[3],
    );

    console.log(`Total message count: ${messageCount}`);
  });
});
