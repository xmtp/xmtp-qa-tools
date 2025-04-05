import type { Worker, WorkerManager } from "@workers/manager";
import { type Client, type Conversation } from "@xmtp/node-sdk";
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

export const sdkVersions = {
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
  const allWorkers = testConfig.workers?.getWorkers();
  const manualUsers = testConfig.manualUsers;
  const inboxIds = [];
  for (const user in manualUsers) {
    inboxIds.push(manualUsers[user].inboxId);
  }
  for (const worker of allWorkers) {
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
    const workerId = testConfig.workerIds[i];
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
export const randomSyncs = async (workers: Worker[]) => {
  for (const worker of workers) {
    const randomSyncs = Math.floor(Math.random() * 3);
    if (randomSyncs === 0) {
      await worker.client.conversations.sync();
    } else if (randomSyncs === 1) {
      await worker.client.conversations.syncAll();
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
