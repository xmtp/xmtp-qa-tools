import type { Worker, WorkerManager } from "@workers/manager";
import { type Client, type Conversation, type Group } from "@xmtp/node-sdk";
import {
  Client as Client47,
  Conversation as Conversation47,
  Dm as Dm47,
  Group as Group47,
} from "@xmtp/node-sdk-47";
import {
  Client as Client100,
  Conversation as Conversation100,
  Dm as Dm100,
  Group as Group100,
} from "@xmtp/node-sdk-100";
import {
  Client as Client104,
  Conversation as Conversation104,
  Dm as Dm104,
  Group as Group104,
} from "@xmtp/node-sdk-104";
import {
  Client as Client105,
  Conversation as Conversation105,
  Dm as Dm105,
  Group as Group105,
} from "@xmtp/node-sdk-105";
import { C } from "vitest/dist/chunks/reporters.d.CfRkRKN2.js";

export const sdkVersions = {
  47: {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
  },
  100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
  },
  104: {
    Client: Client104,
    Conversation: Conversation104,
    Dm: Dm104,
    Group: Group104,
  },
  105: {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
  },
};

export const createRandomInstallations = async (
  count: number,
  worker: Worker,
) => {
  let returnWorker: Worker | undefined;
  console.log(`[${worker.name}] Creating ${count} installations`);
  const inboxState = await worker.client.preferences.inboxState(true);
  console.log(`[${worker.name}] Inbox state: ${JSON.stringify(inboxState)}`);
  for (let i = 0; i < count; i++) {
    console.log(`[${worker.name}] Creating installation ${i + 1}`);
    await worker.worker?.clearDB();
    await worker.worker?.initialize();
    returnWorker = worker;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log(`[${worker.name}] Created ${count} installations`);
  const inboxState2 = await worker.client.preferences.inboxState(true);
  console.log(`[${worker.name}]   Inbox state: ${JSON.stringify(inboxState2)}`);
  return returnWorker;
};
// Network condition presets for testing
const networkConditions = {
  highLatency: { latencyMs: 1000, jitterMs: 200 },
  packetLoss: { packetLossRate: 0.3 },
  disconnection: { disconnectProbability: 0.2, disconnectDurationMs: 5000 },
  bandwidthLimit: { bandwidthLimitKbps: 100 },
  poorConnection: {
    latencyMs: 500,
    jitterMs: 100,
    packetLossRate: 0.1,
    bandwidthLimitKbps: 200,
  },
} as const;

type NetworkConditionKey = keyof typeof networkConditions;
type NetworkCondition = (typeof networkConditions)[NetworkConditionKey];

// Function to get a random version from the versions array
export const getRandomVersion = (versions: string[]) => {
  const randomIndex = Math.floor(Math.random() * versions.length);
  return versions[randomIndex];
};
export const getAllWorkersfromConfig = (testConfig: any): string[] => {
  const manualUsers = testConfig.manualUsers;
  const inboxIds = [];
  for (const user in manualUsers) {
    inboxIds.push(manualUsers[user]);
  }
  for (const worker of testConfig.workers.getWorkers()) {
    inboxIds.push(worker.client.inboxId);
  }
  return inboxIds as string[];
};
// Function to get a random network condition
export const getRandomNetworkCondition = (): NetworkCondition => {
  const conditions = Object.keys(networkConditions) as NetworkConditionKey[];
  const randomIndex = Math.floor(Math.random() * conditions.length);
  return networkConditions[conditions[randomIndex]];
};
export const getWorkerConfigs = (testConfig: any) => {
  // Create worker configs for all workers with random versions
  const workerConfigs = [];

  for (let i = 0; i < testConfig.workerNames.length; i++) {
    const workerName = testConfig.workerNames[i];
    const workerId = getRandomVersion(testConfig.workerIds as string[]);
    const workerVersion = getRandomVersion(testConfig.versions as string[]);
    console.log(`${workerName} using version: ${workerVersion}`);

    workerConfigs.push(`${workerName}-${workerId}-${workerVersion}`);
  }
  return workerConfigs;
};
export const getOrCreateGroup = async (groupId: string, creator: Client) => {
  let globalGroup: Conversation | undefined;
  if (!groupId) {
    globalGroup = await creator.conversations.newGroup([]);
  } else {
    globalGroup = await creator.conversations.getConversationById(groupId);
  }
  return globalGroup;
};
export const randomlyAsignAdmins = async (group: Group) => {
  const randomAdmin = Math.floor(Math.random() * 3);
  await group.sync();
  const members = await group.members();
  if (randomAdmin === 0) {
    await group.addAdmin(members[0].inboxId);
  } else if (randomAdmin === 1) {
    await group.addSuperAdmin(members[1].inboxId);
  } else {
    await group.addAdmin(members[2].inboxId);
  }
};
export const randomSyncs = async (workers: WorkerManager, group: Group) => {
  for (const worker of workers.getWorkers()) {
    const randomSyncs = Math.floor(Math.random() * 4);
    if (randomSyncs === 0) {
      await worker.client.conversations.sync();
    } else if (randomSyncs === 1) {
      await worker.client.conversations.syncAll();
    } else {
      await group.sync();
    }
  }
};

// Function to send message from a worker with name and count
export const sendMessageWithCount = async (
  worker: Worker,
  groupId: string,
  messageCount: number,
): Promise<number> => {
  try {
    const group =
      await worker.client.conversations.getConversationById(groupId);
    const message = `${worker.name} ${messageCount}`;

    console.log(
      `${worker.name} sending message: "${message}" to group ${groupId}`,
    );
    await group?.send(message);
    return messageCount + 1;
  } catch (e) {
    console.error(`Error sending message from ${worker.name}:`, e);
    return messageCount;
  }
};
export const randomlyRemoveDb = async (workers: WorkerManager) => {
  for (const worker of workers.getWorkers()) {
    let fityfity = Math.random() < 0.5;
    if (fityfity) {
      console.warn(
        `${worker.name} terminates, deletes local data, and restarts`,
      );
      await worker.worker?.clearDB();
      await worker.worker?.initialize();
    }
  }
};
export const setRandomNetworkConditions = (workers: WorkerManager) => {
  const bobCondition = getRandomNetworkCondition();
  const aliceCondition = getRandomNetworkCondition();
  const ivyCondition = getRandomNetworkCondition();

  console.log("Applying network conditions:");
  console.log(`Bob: ${JSON.stringify(bobCondition)}`);
  console.log(`Alice: ${JSON.stringify(aliceCondition)}`);
  console.log(`Ivy: ${JSON.stringify(ivyCondition)}`);

  workers.setWorkerNetworkConditions("bob", bobCondition);
  workers.setWorkerNetworkConditions("alice", aliceCondition);
  workers.setWorkerNetworkConditions("ivy", ivyCondition);
};
