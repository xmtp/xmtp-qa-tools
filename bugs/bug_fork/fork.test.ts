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
  removeMember,
  sendMessageWithCount,
  setRandomNetworkConditions,
} from "@helpers/tests";
import type { Worker, WorkerManager } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import type { Conversation, Group } from "@xmtp/node-sdk";
import { describe, it } from "vitest";

const testName = "bug_fork";
loadEnv(testName);

const testConfig = {
  testName,
  versions: ["100", "104", "105"],
  workerNames: ["bob", "alice", "ivy"],
  workerIds: ["a", "device", "device2"],
  manualUsers: {
    convos: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
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

describe(testName, () => {
  // Test behavior switches
  let globalGroup: Conversation | undefined;
  let messageCount = 0 as number;
  let rootWorker: WorkerManager | undefined;
  const workerConfigs = getWorkerConfigs(testConfig);
  it("should initialize all workers at once and create group", async () => {
    rootWorker = await getWorkers([testConfig.rootWorker], testName, "message");
    const fabri = rootWorker.getWorkers()[0];
    testConfig.workers = await getWorkers(workerConfigs, testName, "none");

    globalGroup = (await getOrCreateGroup(
      testConfig,
      fabri.client,
    )) as Conversation;
    testConfig.groupId = globalGroup.id;
    await (globalGroup as Group).updateName(globalGroup.id);
    console.log("Get group with ID:", globalGroup.id);
    // Bob sends first message after creating the group
    messageCount = await sendMessageWithCount(
      fabri,
      globalGroup?.id,
      messageCount,
    );
    console.log("Get group with ID:", globalGroup.id);
  });

  for (let i = 0; i < 1; i++) {
    it("should send messages to group", async () => {
      let bob = testConfig.workers?.get(
        "bob",
        workerConfigs[0].split("-")[1],
      ) as Worker;
      const alice = testConfig.workers?.get(
        "alice",
        workerConfigs[1].split("-")[1],
      ) as Worker;
      const ivy = testConfig.workers?.get(
        "ivy",
        workerConfigs[2].split("-")[1],
      ) as Worker;

      await (globalGroup as Group).updateName(globalGroup?.id as string);
      if (testConfig.createRandomInstallations)
        bob = (await createRandomInstallations(2, bob)) as Worker;
      // Apply random network conditions to each worker if enabled
      if (testConfig.enableNetworkConditions)
        setRandomNetworkConditions(testConfig.workers as WorkerManager);

      if (testConfig.enableRandomSyncs) await randomSyncs(testConfig);

      messageCount = await sendMessageWithCount(
        bob,
        globalGroup?.id as string,
        messageCount,
      );
      await (globalGroup as Group).updateName(globalGroup?.id as string);

      messageCount = await sendMessageWithCount(
        alice,
        globalGroup?.id as string,
        messageCount,
      );

      if (testConfig.randomlyAsignAdmins)
        await randomlyAsignAdmins(globalGroup as Group);

      if (testConfig.removeMembers)
        await removeMember(globalGroup as Group, ivy);

      if (testConfig.enableRandomSyncs) await randomSyncs(testConfig);

      // Add alice to the group and have her send a message
      await (globalGroup as Group).addMembers([alice?.client.inboxId]);
      messageCount = await sendMessageWithCount(
        alice,
        globalGroup?.id as string,
        messageCount,
      );
      console.log(`${alice?.name} sent ${messageCount} messages`);

      if (testConfig.enableRandomSyncs) await randomSyncs(testConfig);

      messageCount = await sendMessageWithCount(
        bob,
        globalGroup?.id as string,
        messageCount,
      );
      if (testConfig.randomlyAsignAdmins)
        await randomlyAsignAdmins(globalGroup as Group);

      //Ivy is removed from the group, so we need to add her again
      await (globalGroup as Group).addMembers([ivy?.client.inboxId]);
      // Add alice to the group and have her send a message
      messageCount = await sendMessageWithCount(
        ivy,
        globalGroup?.id as string,
        messageCount,
      );
    });
  }
});
