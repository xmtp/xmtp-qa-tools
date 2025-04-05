import { loadEnv } from "@helpers/client";
import {
  getAllWorkersfromConfig,
  getOrCreateGroup,
  getWorkerConfigs,
  randomSyncs,
  sendMessageWithCount,
  setRandomNetworkConditions,
} from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

const testName = "bug_fork";
loadEnv(testName);

// Test configuration object
const testConfig = {
  // Group configuration
  groupId: "06fc64d6ef6a5c5bce188e4055752413",
  // Test metadata
  testName: "bug_fork",
  versions: ["105"],

  // Manual users for testing
  manualUsers: {
    // convos: {
    //   inboxId:
    //     "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    //   env: "dev",
    // },
    xmtpchat: {
      inboxId:
        "dc85c4016ededfe9745c8eb623fc7473be85498bfd70703300d99dc29e10f235",
      env: "dev",
    },
  },

  // Worker configuration
  workerNames: ["bob", "alice", "ivy"],
  workerIds: ["a", "b", "c"],
  numWorkers: 3,

  // Test behavior switches
  removeDbs: true,
  enableNetworkConditions: false, // Toggle network condition simulation
  enableRandomSyncs: false, // Toggle random sync operations before sending messages
  hasFailures: false,
  workers: undefined as WorkerManager | undefined,
  globalGroup: undefined as Conversation | undefined,
  messageCount: 0 as number,
};

describe(testConfig.testName, () => {
  it("should initialize all workers at once and create group", async () => {
    const workerConfigs = getWorkerConfigs(testConfig);

    console.log("Creating all workers with configs:", workerConfigs);

    testConfig.workers = await getWorkers(
      workerConfigs,
      testName,
      "message",
      true,
    );
    // Apply random network conditions to each worker if enabled
    if (testConfig.enableNetworkConditions)
      setRandomNetworkConditions(testConfig.workers);

    if (testConfig.enableRandomSyncs)
      await randomSyncs(testConfig.workers?.getWorkers() || []);

    testConfig.globalGroup = (await getOrCreateGroup(
      testConfig.groupId,
      testConfig.workers?.get("bob", "a")?.client as Client,
    )) as Conversation;

    console.log("Get group with ID:", testConfig.globalGroup?.id);
  });

  it("add all workers to group", async () => {
    const inboxIds = getAllWorkersfromConfig(testConfig);
    await (testConfig.globalGroup as Group).addMembers(inboxIds);
    console.log("Added all workers to group");
  });

  it("should send messages to group", async () => {
    const workers = testConfig.workers?.getWorkers();
    if (!workers) {
      throw new Error("No workers found");
    }
    for (const worker of workers) {
      // Random sync operations before sending message if enabled
      if (testConfig.enableRandomSyncs) await randomSyncs([worker]);

      // Bob sends first message after creating the group
      testConfig.messageCount = await sendMessageWithCount(
        worker,
        testConfig.globalGroup?.id as string,
        testConfig.messageCount,
      );
    }
  });

  it("remove alice from group", async () => {
    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).removeMembers([
      testConfig.workers?.get("alice", "b")?.client.inboxId as string,
    ]);
    console.log("Removed alice from group");

    // Add ivy to the group and have her send a message
    await (testConfig.globalGroup as Group).addMembers([
      testConfig.workers?.get("ivy", "c")?.client.inboxId as string,
    ]);
    console.log("Added ivy to group");
    testConfig.messageCount = await sendMessageWithCount(
      testConfig.workers?.get("ivy", "c") as Worker,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );

    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).addMembers([
      testConfig.workers?.get("alice", "b")?.client.inboxId as string,
    ]);
    console.log("Added alice to group");
    testConfig.messageCount = await sendMessageWithCount(
      testConfig.workers?.get("alice", "b") as Worker,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );

    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).addMembers([
      testConfig.workers?.get("alice", "b")?.client.inboxId as string,
    ]);
    console.log("Added alice to group");
    await sendMessageWithCount(
      testConfig.workers?.get("alice", "b") as Worker,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );
  });

  it("add all workers to group", async () => {
    const inboxIds = getAllWorkersfromConfig(testConfig);
    await (testConfig.globalGroup as Group).addMembers(inboxIds);
    console.log("Added all workers to group", testConfig.globalGroup?.id);
  });
});
