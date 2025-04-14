import fs from "fs";
import { getEnvPath } from "@helpers/client";
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
import {
  Client as ClientMls,
  Conversation as ConversationMls,
} from "@xmtp/node-sdk-mls";

// SDK version mappings
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

/**
 * Creates random installations for a worker
 */
export const createRandomInstallations = async (
  count: number,
  worker: Worker,
): Promise<Worker | undefined> => {
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

/**
 * Gets a random version from the versions array
 */
export const getRandomVersion = (versions: string[]): string => {
  if (versions.length === 0) {
    throw new Error("versions array is empty");
  }
  const randomIndex = Math.floor(Math.random() * versions.length);
  return versions[randomIndex];
};

/**
 * Gets all worker inbox IDs from the test config
 */
export const getAllWorkersfromConfig = (testConfig: {
  manualUsers: Record<string, string>;
  workers: WorkerManager;
}): string[] => {
  const manualUsers = testConfig.manualUsers;
  const inboxIds: string[] = [];

  for (const user in manualUsers) {
    inboxIds.push(manualUsers[user]);
  }

  for (const worker of testConfig.workers.getWorkers()) {
    inboxIds.push(worker.client.inboxId);
  }

  return inboxIds;
};

/**
 * Gets a random network condition
 */
export const getRandomNetworkCondition = (): NetworkCondition => {
  const conditions = Object.keys(networkConditions) as NetworkConditionKey[];
  const randomIndex = Math.floor(Math.random() * conditions.length);
  return networkConditions[conditions[randomIndex]];
};

/**
 * Gets worker configs with random versions
 */
export const getWorkerConfigs = (testConfig: {
  workerNames: string[];
  installationNames: string[];
  versions: string[];
}): string[] => {
  const workerConfigs: string[] = [];

  for (let i = 0; i < testConfig.workerNames.length; i++) {
    const workerName = testConfig.workerNames[i];
    const workerId = getRandomVersion(testConfig.installationNames);
    const workerVersion = getRandomVersion(testConfig.versions);
    console.log(`${workerName} using version: ${workerVersion}`);

    workerConfigs.push(`${workerName}-${workerId}-${workerVersion}`);
  }

  console.log("Worker configs:", workerConfigs);
  return workerConfigs;
};

/**
 * Randomly assigns admin privileges to a group member
 */
export const randomlyAsignAdmins = async (group: Group): Promise<void> => {
  await group.sync();
  const members = await group.members();

  // Only proceed if there are members to assign
  if (members.length === 0) {
    console.log("No members available to assign as admin");
    return;
  }

  // Select a random member from the available members
  const randomIndex = Math.floor(Math.random() * members.length);
  const randomAdminType = Math.floor(Math.random() * 2); // 0 for admin, 1 for superAdmin

  try {
    if (randomAdminType === 0) {
      await group.addAdmin(members[randomIndex].inboxId);
      console.log(`Added ${members[randomIndex].inboxId} as admin`);
    } else {
      await group.addSuperAdmin(members[randomIndex].inboxId);
      console.log(`Added ${members[randomIndex].inboxId} as super admin`);
    }
  } catch (error) {
    console.error("Error assigning admin:", error);
  }
};

/**
 * Removes a member from a group
 */
export const removeMemberByWorker = async (
  groupId: string,
  memberToRemove: string,
  memberWhoRemoves: Worker,
): Promise<void> => {
  try {
    if (!memberToRemove) {
      console.log(`Member ${memberToRemove} not found`);
      return;
    }
    console.log("Removing member", memberToRemove);
    const group =
      await memberWhoRemoves.client.conversations.getConversationById(groupId);
    await group?.sync();
    const members = await group?.members();
    const memberFound = members?.find(
      (m) => m.inboxId.toLowerCase() === memberToRemove.toLowerCase(),
    );
    if (!memberFound) {
      console.log(`Member ${memberToRemove} not found in group ${groupId}`);
      return;
    }
    // Check if member is admin or super admin and demote first
    if ((group as Group)?.isAdmin(memberToRemove)) {
      console.log(`Demoting admin: ${memberToRemove}`);
      await (group as Group).removeAdmin(memberToRemove);
    }

    if ((group as Group)?.isSuperAdmin(memberToRemove)) {
      console.log(`Demoting super admin: ${memberToRemove}`);
      await (group as Group).removeSuperAdmin(memberToRemove);
    }

    await (group as Group).removeMembers([memberToRemove]);
  } catch (error) {
    console.error("Error removing member:", error);
  }
};

/**
 * Performs random syncs on workers
 */
export const randomSyncs = async (testConfig: {
  workers: WorkerManager;
  groupId: string;
}): Promise<void> => {
  for (const worker of testConfig.workers.getWorkers()) {
    const randomSyncs = Math.floor(Math.random() * 1); // 0 for sync, 1 for syncAll
    if (randomSyncs === 0) {
      await worker.client.conversations.sync();
    } else if (randomSyncs === 1) {
      await worker.client.conversations.syncAll();
    } else {
      const group = await worker.client.conversations.getConversationById(
        testConfig.groupId,
      );
      await group?.sync();
    }
  }
};

/**
 * Sends a message from a worker with name and count
 */
export const sendMessageWithCount = async (
  worker: Worker,
  groupId: string,
  messageCount: number,
): Promise<number> => {
  try {
    // Randomly choose between different sync approaches
    const syncChoice = Math.floor(Math.random() * 1); // 0 for sync, 1 for syncAll
    if (syncChoice === 0) {
      await worker.client.conversations.sync();
      console.log(`${worker.name} performed client sync`);
    } else if (syncChoice === 1) {
      await worker.client.conversations.syncAll();
      console.log(`${worker.name} performed client syncAll`);
    }

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

/**
 * Randomly removes database from workers
 */
export const randomlyRemoveDb = async (
  workers: WorkerManager,
): Promise<void> => {
  for (const worker of workers.getWorkers()) {
    const shouldRemove = Math.random() < 0.5;
    if (shouldRemove) {
      console.warn(
        `${worker.name} terminates, deletes local data, and restarts`,
      );
      await worker.worker?.clearDB();
      await worker.worker?.initialize();
    }
  }
};

/**
 * Sets random network conditions for workers
 */
export const setRandomNetworkConditions = (workers: WorkerManager): void => {
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

/**
 * Sends an initial test message to the bot
 */
export const sendInitialTestMessage = async (client: Client): Promise<void> => {
  try {
    // Send dm to the bot
    const dm = await client.conversations.newDm(
      process.env.CONVOS_USER as string,
    );

    await dm.send("gm from bot");
    console.log("DM sent:", dm.id, "to", process.env.CONVOS_USER);

    const dm2 = await client.conversations.newDm(process.env.CB_USER as string);
    await dm2.send("gm from bot");
    console.log("DM sent:", dm2.id, "to", process.env.CB_USER);
  } catch (error) {
    console.error("Error sending initial test message:", error);
  }
};

/**
 * Adds a member to a group by a worker
 */
export const addMemberByWorker = async (
  groupId: string,
  membertoAdd: string,
  memberWhoAdds: Worker,
): Promise<void> => {
  await memberWhoAdds.client.conversations.syncAll();
  const group =
    await memberWhoAdds.client.conversations.getConversationById(groupId);

  if (!group) {
    console.log(`Group with ID ${groupId} not found`);
    return;
  }

  // Check if member already exists in the group
  const members = await (group as Group).members();
  const memberExists = members.some(
    (member) => member.inboxId.toLowerCase() === membertoAdd.toLowerCase(),
  );

  if (memberExists) {
    console.log(`Member ${membertoAdd} already exists in group ${groupId}`);
    return;
  }

  // Add member if they don't exist
  await (group as Group).addMembers([membertoAdd]);
  console.log(`Added member ${membertoAdd} to group ${groupId}`);
};

/**
 * Gets or creates a group
 */
export const getOrCreateGroup = async (
  testConfig: {
    testName: string;
  },
  creator: Client,
): Promise<Conversation | undefined> => {
  let globalGroup: Conversation | undefined;
  const GROUP_ID = process.env.GROUP_ID;

  if (!GROUP_ID) {
    globalGroup = await creator.conversations.newGroup([]);
    console.log("Creating group with ID:", globalGroup.id);
    console.log("Updated test config with group ID:", globalGroup.id);

    // Write the group ID to the .env file
    appendToEnv("GROUP_ID", globalGroup.id, testConfig.testName);
  } else {
    globalGroup = await creator.conversations.getConversationById(GROUP_ID);
  }

  return globalGroup;
};

/**
 * Appends a variable to the .env file
 * @param key - The environment variable key
 * @param value - The environment variable value
 * @param testName - The test name (optional)
 */
export const appendToEnv = (
  key: string,
  value: string,
  testName: string = "",
): void => {
  try {
    console.log("Appending to .env file at:", testName);
    const envPath = getEnvPath(testName);

    // Update process.env if the property exists
    if (key in process.env) {
      process.env[key] = value;
      console.log(`Updated process.env with new ${key}:`, value);
    }

    console.log("Appending to .env file at:", envPath);
    let envContent = "";
    try {
      envContent = fs.readFileSync(envPath, "utf8");
    } catch (error: unknown) {
      // File doesn't exist, create it
      console.log("Creating new .env file");
    }

    // Escaping regex special characters from key to avoid unintended matches
    const escapeRegex = (str: string) =>
      str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const escapedKey = escapeRegex(key);

    // Replace existing key or add it if it doesn't exist
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(
        new RegExp(`${escapedKey}=.*(\\r?\\n|$)`, "g"),
        `${key}="${value}"$1`,
      );
    } else {
      envContent += `\n${key}="${value}"\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`Updated .env file with new ${key}:`, value);
  } catch (error: unknown) {
    console.error(`Failed to update .env file with ${key}:`, error);
  }
};
