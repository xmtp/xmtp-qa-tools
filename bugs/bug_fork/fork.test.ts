import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import {
  createRandomInstallations,
  getAllWorkersfromConfig,
  getOrCreateGroup,
  getWorkerConfigs,
  randomlyAsignAdmins,
  randomlyRemoveDb,
  randomSyncs,
  sendMessageWithCount,
  setRandomNetworkConditions,
} from "@helpers/tests";
import type { Worker, WorkerManager } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import type { Conversation, Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "bug_fork";
loadEnv(testName);

const testConfig = {
  groupId: "d0f58a4c78c7574df2c9b1504721628d",
  testName: "bug_fork",
  versions: ["100", "104", "105"],
  workerNames: ["bob", "alice", "ivy"],
  workerIds: ["a", "device", "device2"],
  manualUsers: {
    convos: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    xmtpchat:
      "a867afb928842d104f7e0f64311398723875ea73c3525399e88bb9f7aa4622f4",
  },
  workers: undefined as WorkerManager | undefined,
  removeDbs: true,
  enableNetworkConditions: true, // Toggle network condition simulation
  enableRandomSyncs: true, // Toggle random sync operations before sending messages
  randomlyAsignAdmins: true,
  createRandomInstallations: false,
  rootWorker: "fabri",
};

describe(testName, () => {
  // Test behavior switches
  let globalGroup: Conversation | undefined;
  let messageCount = 0 as number;
  let rootWorker: WorkerManager | undefined;
  const workerConfigs = getWorkerConfigs(testConfig);
  it("should initialize all workers at once and create group", async () => {
    rootWorker = await getWorkers(
      [testConfig.rootWorker],
      testName,
      "message",
      false,
    );
    const fabri = rootWorker.getWorkers()[0];
    globalGroup = (await getOrCreateGroup(
      testConfig.groupId,
      fabri.client,
    )) as Conversation;
    console.log("Get group with ID:", globalGroup.id);
    // Bob sends first message after creating the group
    messageCount = await sendMessageWithCount(
      fabri,
      globalGroup?.id,
      messageCount,
    );
    console.log("Get group with ID:", globalGroup.id);
  });

  it("initialize workers", async () => {
    testConfig.workers = await getWorkers(
      workerConfigs,
      testName,
      "message",
      false,
    );

    // Apply random network conditions to each worker if enabled
    if (testConfig.enableNetworkConditions)
      setRandomNetworkConditions(testConfig.workers);

    if (testConfig.enableRandomSyncs)
      await randomSyncs(testConfig.workers, globalGroup as Group);

    const inboxIds = getAllWorkersfromConfig(testConfig);
    await (globalGroup as Group).addMembers(inboxIds);
    console.log("Added all workers to group");
  });

  it("should send messages to group", async () => {
    try {
      let bob = testConfig.workers?.get("bob", workerConfigs[0].split("-")[1]);
      const alice = testConfig.workers?.get(
        "alice",
        workerConfigs[1].split("-")[1],
      );
      const ivy = testConfig.workers?.get(
        "ivy",
        workerConfigs[2].split("-")[1],
      );

      if (!testConfig.workers || !bob || !alice || !ivy) {
        throw new Error("Workers not initialized");
      }

      if (testConfig.createRandomInstallations)
        bob = (await createRandomInstallations(50, bob)) as Worker;

      if (testConfig.enableRandomSyncs)
        await randomSyncs(testConfig.workers, globalGroup as Group);

      messageCount = await sendMessageWithCount(
        bob,
        testConfig.groupId,
        messageCount,
      );

      // Add alice to the group and have her send a message
      console.log(
        `Removing ${alice?.name} from group ${alice?.client.inboxId}`,
      );
      await (globalGroup as Group).removeMembers([alice?.client.inboxId]);
      console.log(`Removed ${alice?.name} from group`);
      if (testConfig.randomlyAsignAdmins)
        await randomlyAsignAdmins(globalGroup as Group);

      if (testConfig.removeDbs) await randomlyRemoveDb(testConfig.workers);
      if (testConfig.enableRandomSyncs)
        await randomSyncs(testConfig.workers, globalGroup as Group);

      console.log(`Added ${ivy?.name} to group`);
      // Bob sends first message after creating the group
      messageCount = await sendMessageWithCount(
        ivy,
        testConfig.groupId,
        messageCount,
      );
      if (testConfig.removeDbs) await randomlyRemoveDb(testConfig.workers);
      // Add alice to the group and have her send a message
      await (globalGroup as Group).addMembers([alice?.client.inboxId]);
      console.log(`Added ${alice?.name} to group`);
      messageCount = await sendMessageWithCount(
        alice,
        testConfig.groupId,
        messageCount,
      );
      console.log(`${alice?.name} sent ${messageCount} messages`);

      if (testConfig.enableRandomSyncs)
        await randomSyncs(testConfig.workers, globalGroup as Group);

      messageCount = await sendMessageWithCount(
        bob,
        testConfig.groupId,
        messageCount,
      );
      if (testConfig.randomlyAsignAdmins)
        await randomlyAsignAdmins(globalGroup as Group);

      if (testConfig.removeDbs) await randomlyRemoveDb(testConfig.workers);
      // Add alice to the group and have her send a message
      await (globalGroup as Group).removeMembers([ivy?.client.inboxId]);
      console.log(`Removed ${ivy?.name} from group`);

      messageCount = await sendMessageWithCount(
        alice,
        testConfig.groupId,
        messageCount,
      );
      if (testConfig.randomlyAsignAdmins)
        await randomlyAsignAdmins(globalGroup as Group);
    } catch (e) {
      logError(e, expect);
      throw e;
    }
  });
});
