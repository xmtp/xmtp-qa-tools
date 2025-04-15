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
  Client as Client105,
  Conversation as Conversation105,
  Dm as Dm105,
  Group as Group105,
} from "@xmtp/node-sdk-105";
import {
  Client as Client200,
  Conversation as Conversation200,
  Dm as Dm200,
  Group as Group200,
} from "@xmtp/node-sdk-200";
import {
  Client as ClientMls,
  Conversation as ConversationMls,
} from "@xmtp/node-sdk-mls";

// SDK version mappings
export const sdkVersions = {
  30: {
    Client: ClientMls,
    Conversation: ConversationMls,
    Dm: ConversationMls,
    Group: ConversationMls,
    sdkVersion: "0.0.30",
    libxmtpVersion: "unknown",
  },
  47: {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
    sdkVersion: "0.0.47",
    libxmtpVersion: "0.0.41",
  },
  100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
    sdkVersion: "1.0.0",
    libxmtpVersion: "1.0.0",
  },
  105: {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
    sdkVersion: "1.0.5",
    libxmtpVersion: "1.1.3",
  },
  200: {
    Client: Client200,
    Conversation: Conversation200,
    Dm: Dm200,
    Group: Group200,
    sdkVersion: "2.0.0",
    libxmtpVersion: "1.2.0-dev.bed98df",
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
 * Randomly updates the name of a group using a random member
 */
export const randomDescriptionUpdate = async (
  group: Group,
  workers: WorkerManager,
): Promise<void> => {
  const members = await group.members();
  if (members.length === 0) {
    console.log("No members available to update group name");
    return;
  }

  const randomMember = members[Math.floor(Math.random() * members.length)];
  const newName = `Randomly updated group name ${Math.random().toString(36).substring(2, 15)}`;
  const allWorkers = workers.getWorkers();
  const randomWorker = allWorkers.filter(
    (w) => w.client.inboxId === randomMember.inboxId,
  )[0];
  if (!randomWorker) {
    console.log("No worker found for random member");
    return;
  }
  const foundGroup =
    await randomWorker.client.conversations.getConversationById(group.id);
  if (!foundGroup) {
    console.log("No group found for random member");
    return;
  }
  await (foundGroup as Group).updateName(newName);
  console.log(`Group name updated by ${randomMember.inboxId} to: ${newName}`);
};

/**
 * Randomly updates the name of a group using a random member
 */
export const randomNameUpdate = async (
  group: Group,
  workers: WorkerManager,
): Promise<void> => {
  const members = await group.members();
  if (members.length === 0) {
    console.log("No members available to update group name");
    return;
  }

  const randomMember = members[Math.floor(Math.random() * members.length)];
  const newName = `Randomly updated group name ${Math.random().toString(36).substring(2, 15)}`;
  const allWorkers = workers.getWorkers();
  const randomWorker = allWorkers.filter(
    (w) => w.client.inboxId === randomMember.inboxId,
  )[0];
  if (!randomWorker) {
    console.log("No worker found for random member");
    return;
  }
  const foundGroup =
    await randomWorker.client.conversations.getConversationById(group.id);
  if (!foundGroup) {
    console.log("No group found for random member");
    return;
  }
  await (foundGroup as Group).updateName(newName);
  console.log(`Group name updated by ${randomMember.inboxId} to: ${newName}`);
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
 * Randomly reinstalls a worker
 */
export const randomReinstall = async (
  workers: WorkerManager,
): Promise<void> => {
  const worker = workers.getRandomWorkers(1)[0];
  console.log(`[${worker.name}] Reinstalling worker`);
  await worker.worker?.reinstall();
};

/**
 * Performs random syncs on workers
 */
export const randomSyncs = async (testConfig: {
  workers: WorkerManager;
  groupId: string;
}): Promise<void> => {
  for (const worker of testConfig.workers.getWorkers()) {
    const randomSyncs = Math.floor(Math.random() * 2); // 0 for sync, 1 for syncAll
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

/**
 * Simulates a client missing cursor messages to reproduce the fork bug
 * This recreates the scenario where a client misses a critical epoch-advancing message
 */
export const simulateMissingCursorMessage = async (
  worker: Worker,
  groupId: string,
): Promise<void> => {
  console.log(
    `[${worker.name}] Simulating backgrounded app missing cursor messages`,
  );

  // First reinstall the worker to clear its state (like app restarting)
  await worker.worker?.reinstall();

  // Skip sync, which would normally happen after reinstall
  console.log(
    `[${worker.name}] Worker reinstalled but sync intentionally skipped`,
  );

  // Force the cursor to advance by one (simulating the off-by-one error)
  try {
    // This is a simulation of the cursor issue. In the real implementation,
    // we would need to modify the cursor directly in the database or through
    // an API if available. For now, we'll just log that we're simulating this.
    console.log(`[${worker.name}] Simulating cursor being off by one message`);

    // In a real fix, we might need to modify the worker's storage
    // or inject a fake cursor value to reproduce the exact bug
  } catch (error) {
    console.error(`Error simulating cursor issue for ${worker.name}:`, error);
  }
};

/**
 * Checks if groups across workers are in a forked state
 * Returns true if a fork is detected (different group states)
 */
export const checkForGroupFork = async (
  workers: Worker[],
  groupId: string,
): Promise<boolean> => {
  console.log(`Checking for group fork in group ${groupId}`);

  if (workers.length < 2) {
    console.log("Need at least 2 workers to check for a fork");
    return false;
  }

  const groupStates: Record<string, any> = {};

  // Get group state from each worker
  for (const worker of workers) {
    try {
      const group =
        await worker.client.conversations.getConversationById(groupId);

      if (!group) {
        console.log(`Group not found for worker ${worker.name}`);
        continue;
      }

      // In a real implementation, we would extract the epoch or other state
      // information that would indicate a fork. For now, we'll use what's available
      // in the public API.
      const members = await (group as Group).members();
      const memberCount = members.length;

      // Store group state for this worker
      groupStates[worker.name] = {
        memberCount,
        name: (group as Group).name,
        description: (group as Group).description,
      };

      console.log(
        `${worker.name} group state:`,
        JSON.stringify(groupStates[worker.name]),
      );
    } catch (error) {
      console.error(`Error getting group state for ${worker.name}:`, error);
    }
  }

  // Compare group states to detect forks
  const workerNames = Object.keys(groupStates);
  if (workerNames.length < 2) {
    console.log("Not enough group states to compare");
    return false;
  }

  const firstWorkerState = groupStates[workerNames[0]];
  let forkDetected = false;

  // Compare each worker's state with the first worker
  for (let i = 1; i < workerNames.length; i++) {
    const currentWorkerState = groupStates[workerNames[i]];

    // Compare number of members - a common fork symptom
    if (currentWorkerState.memberCount !== firstWorkerState.memberCount) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has ${firstWorkerState.memberCount} members, but ${workerNames[i]} has ${currentWorkerState.memberCount} members`,
      );
      forkDetected = true;
    }

    // Compare group name
    if (currentWorkerState.name !== firstWorkerState.name) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has group name "${firstWorkerState.name}", but ${workerNames[i]} has "${currentWorkerState.name}"`,
      );
      forkDetected = true;
    }

    // Compare group description
    if (currentWorkerState.description !== firstWorkerState.description) {
      console.log(
        `FORK DETECTED: ${workerNames[0]} has description "${firstWorkerState.description}", but ${workerNames[i]} has "${currentWorkerState.description}"`,
      );
      forkDetected = true;
    }
  }

  if (!forkDetected) {
    console.log("No group fork detected - all clients have consistent state");
  }

  return forkDetected;
};
