import { loadEnv } from "@helpers/client";
import {
  getAllWorkersfromConfig,
  getOrCreateGroup,
  getWorkerConfigs,
  randomSyncs,
  sendMessageWithCount,
  setRandomNetworkConditions,
} from "@helpers/tests";
import type { Worker, WorkerManager, XmtpEnv } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import type { Client, Conversation, Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "bug_fork";
loadEnv(testName);

// Test configuration object
const testConfig = {
  // Group configuration
  groupId: "c016942985fd74da81d1ba1549e3d98b",
  // Test metadata
  testName: "bug_fork",
  versions: ["100", "104", "105"],

  // Manual users for testing
  manualUsers: {
    convos: {
      inboxId:
        "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
      env: "dev",
    },
    xmtpchat: {
      inboxId:
        "dc85c4016ededfe9745c8eb623fc7473be85498bfd70703300d99dc29e10f235",
      env: "dev",
    },
  },

  // Worker configuration
  workerNames: ["bob", "alice", "ivy"],
  workerIds: ["a", "b", "c"],

  // Test behavior switches
  removeDbs: true,
  enableNetworkConditions: false, // Toggle network condition simulation
  enableRandomSyncs: false, // Toggle random sync operations before sending messages
  hasFailures: false,
  workers: undefined as WorkerManager | undefined,
  globalGroup: undefined as Conversation | undefined,
  messageCount: 0 as number,
};

describe(testName, () => {
  it("should initialize all workers at once and create group", async () => {
    testConfig.workers = await getWorkers(
      getWorkerConfigs(testConfig),
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

    console.log("Get group with ID:", testConfig.globalGroup.id);
  });

  it("add all workers to group", async () => {
    const inboxIds = getAllWorkersfromConfig(testConfig);
    await (testConfig.globalGroup as Group).addMembers(inboxIds);
    console.log("Added all workers to group");
  });

  it("should send messages to group", async () => {
    const bob = testConfig.workers?.get("bob", "a") as Worker;
    const alice = testConfig.workers?.get("alice", "b") as Worker;
    const ivy = testConfig.workers?.get("ivy", "c") as Worker;
    // Bob sends first message after creating the group
    testConfig.messageCount = await sendMessageWithCount(
      bob,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );

    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).removeMembers([
      alice.client.inboxId,
    ]);
    console.log("Removed alice from group");

    // Add ivy to the group and have her send a message
    await (testConfig.globalGroup as Group).addMembers([ivy.client.inboxId]);
    console.log("Added ivy to group");
    // Bob sends first message after creating the group
    testConfig.messageCount = await sendMessageWithCount(
      bob,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );
    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).addMembers([alice.client.inboxId]);
    console.log("Added alice to group");
    testConfig.messageCount = await sendMessageWithCount(
      alice,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );

    // Add alice to the group and have her send a message
    await (testConfig.globalGroup as Group).removeMembers([ivy.client.inboxId]);
    console.log("Removed ivy from group");
    testConfig.messageCount = await sendMessageWithCount(
      alice,
      testConfig.globalGroup?.id as string,
      testConfig.messageCount,
    );
  });
});
