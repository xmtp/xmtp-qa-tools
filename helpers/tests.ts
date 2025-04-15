import fs from "fs";
import { getEnvPath } from "@helpers/client";
import { getWorkersFromGroup } from "@helpers/group";
import type { MessageStreamWorker } from "@workers/main";
import type { Worker, WorkerManager } from "@workers/manager";
import {
  type Client,
  type Conversation,
  type Group,
  type GroupMember,
} from "@xmtp/node-sdk";
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

// Define the expected return type of verifyStream
export type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};

// Default workers as an enum
const defaultNames = [
  "bob",
  "alice",
  "fabri",
  "elon",
  "joe",
  "charlie",
  "dave",
  "rosalie",
  "eve",
  "frank",
  "grace",
  "henry",
  "ivy",
  "jack",
  "karen",
  "larry",
  "mary",
  "nancy",
  "oscar",
  "paul",
  "quinn",
  "rachel",
  "steve",
  "tom",
  "ursula",
  "victor",
  "wendy",
  "xavier",
  "yolanda",
  "zack",
  "adam",
  "bella",
  "carl",
  "diana",
  "eric",
  "fiona",
  "george",
  "hannah",
  "ian",
  "julia",
  "keith",
  "lisa",
  "mike",
  "nina",
  "oliver",
  "penny",
  "quentin",
  "rosa",
  "sam",
  "tina",
  "uma",
  "vince",
  "walt",
  "xena",
  "yara",
  "zara",
  "guada",
  //max 61
];
export const defaultValues = {
  amount: 5,
  timeout: 40000,
  perMessageTimeout: 3000,
  defaultNames,
};

// Custom transport that buffers logs in memory
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}

// SDK version mappings
export const sdkVersions = {
  30: {
    Client: ClientMls,
    Conversation: ConversationMls,
    Dm: ConversationMls,
    Group: ConversationMls,
    sdkPackage: "node-sdk-mls",
    bindingsPackage: "node-bindings-mls",
    sdkVersion: "0.0.13",
    libXmtpVersion: "0.0.9",
  },
  47: {
    Client: Client47,
    Conversation: Conversation47,
    Dm: Dm47,
    Group: Group47,
    sdkPackage: "node-sdk-47",
    bindingsPackage: "node-bindings-41",
    sdkVersion: "0.0.47",
    libXmtpVersion: "6bd613d",
  },
  100: {
    Client: Client100,
    Conversation: Conversation100,
    Dm: Dm100,
    Group: Group100,
    sdkPackage: "node-sdk-100",
    bindingsPackage: "node-bindings-100",
    sdkVersion: "1.0.0",
    libXmtpVersion: "c205eec",
  },
  105: {
    Client: Client105,
    Conversation: Conversation105,
    Dm: Dm105,
    Group: Group105,
    sdkPackage: "node-sdk-105",
    bindingsPackage: "node-bindings-113",
    sdkVersion: "1.0.5",
    libXmtpVersion: "6eb1ce4",
  },
  200: {
    Client: Client200,
    Conversation: Conversation200,
    Dm: Dm200,
    Group: Group200,
    sdkPackage: "node-sdk-200",
    bindingsPackage: "node-bindings-200",
    sdkVersion: "2.0.0",
    libXmtpVersion: "bed98df",
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
      (m: GroupMember) =>
        m.inboxId.toLowerCase() === memberToRemove.toLowerCase(),
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
 * Simplified `verifyStream` that sends messages to a conversation,
 * and ensures each participant collects exactly `count` messages.
 *
 * @param group Conversation (e.g. a group conversation)
 * @param participants Array of Worker objects
 * @param messageGenerator A function that produces the content (including a suffix)
 * @param sender Function to send messages to the conversation
 * @param collectorType The contentType ID to match in collecting
 * @param count Number of messages to send
 */

const nameUpdateGenerator = (i: number, suffix: string) => {
  return `New name-${i + 1}-${suffix}`;
};

const nameUpdater = async (group: Conversation, payload: string) => {
  await (group as Group).updateName(payload);
};

export async function verifyStreamAll(
  group: Conversation,
  participants: WorkerManager,
  count = 1,
) {
  const allWorkers = await getWorkersFromGroup(group, participants);
  return verifyStream(group, allWorkers, "text", count);
}
export async function verifyStream<T extends string = string>(
  group: Conversation,
  participants: Worker[],
  collectorType = "text",
  count = 1,
  generator: (index: number, suffix: string) => T = (
    i: number,
    suffix: string,
  ): T => `gm-${i + 1}-${suffix}` as T,
  sender: (group: Conversation, payload: T) => Promise<void> = async (
    group: Conversation,
    payload: T,
  ) => {
    await group.send(payload);
  },
): Promise<VerifyStreamResult> {
  if (collectorType === "group_updated") {
    generator = nameUpdateGenerator as (index: number, suffix: string) => T;
    sender = nameUpdater as (group: Conversation, payload: T) => Promise<void>;
  }
  // Exclude the group creator from receiving
  const creatorInboxId = (await group.metadata()).creatorInboxId;
  const receivers = participants.filter(
    (p) => p.client?.inboxId !== creatorInboxId,
  );

  // Conversation ID (topic or peerAddress)
  // Modify as needed depending on how you store the ID
  const conversationId = group.id;

  // Unique random suffix to avoid counting old messages
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  // Start collectors
  const collectPromises = receivers.map((r) =>
    r.worker
      ?.collectMessages(conversationId, collectorType, count)
      .then((msgs: MessageStreamWorker[]) =>
        msgs.map((m) => m.message.content as T),
      ),
  );
  // Send the messages
  for (let i = 0; i < count; i++) {
    const payload = generator(i, randomSuffix);
    //console.log(`Sending message #${i + 1}:`, payload);
    await sender(group, payload);
  }
  console.log(`Sent ${count} messages`);

  // Wait for collectors
  const collectedMessages = await Promise.all(collectPromises);
  const allReceived = collectedMessages.every((msgs) => msgs?.length === count);
  if (!allReceived) {
    console.error(
      "Not all participants received the expected number of messages.",
    );
  } else {
    console.log("All participants received the expected number of messages.");
  }

  return {
    allReceived,
    messages: collectedMessages.map((m) => m ?? []),
  };
}

/**
 * Verifies that group conversation stream events are properly received
 * by all participants when a new group is created.
 *
 * @param initiator - The worker creating the group conversation
 * @param participants - Array of workers that should be added to the group and receive the event
 * @param groupCreator - Function to create a new group conversation
 * @returns Promise resolving with results of the verification
 */
export async function verifyConversationStream(
  initiator: Worker,
  participants: Worker[],
): Promise<{ allReceived: boolean; receivedCount: number }> {
  const groupCreator = async (
    initiator: Worker,
    participantAddresses: string[],
  ) => {
    if (!initiator.client) {
      throw new Error("Initiator has no client");
    }
    return initiator.client.conversations.newGroup(participantAddresses);
  };

  console.log(
    `[${initiator.name}] Starting group conversation stream verification test with ${participants.length} participants`,
  );

  if (!initiator.worker) {
    throw new Error(`Initiator ${initiator.name} has no worker`);
  }

  // Set up promises to collect conversations for all participants
  const participantPromises = participants.map((participant) => {
    if (!participant.worker) {
      console.warn(`Participant ${participant.name} has no worker`);
      return Promise.resolve(null);
    }

    if (!initiator.client) {
      throw new Error(`Initiator ${initiator.name} has no client`);
    }

    // Use the worker's collectConversations method to wait for conversation events
    return participant.worker.collectConversations(
      initiator.client.inboxId,
      1, // We expect just one conversation
    );
  });

  // Create a new group conversation
  console.log(
    `[${initiator.name}] Creating new group conversation with ${participants.length} participants`,
  );
  const participantAddresses = participants.map((p) => {
    if (!p.client) {
      throw new Error(`Participant ${p.name} has no client`);
    }
    return p.client.inboxId;
  });

  const createdGroup = await groupCreator(initiator, participantAddresses);

  const createdGroupId = createdGroup.id;
  console.log(
    `[${initiator.name}] Created group conversation with ID: ${createdGroupId}`,
  );

  // Wait for all participant promises to resolve ()
  const results = await Promise.all(participantPromises);
  console.log(
    `[${initiator.name}] Received ${results.length} group conversation notifications`,
  );

  // Count how many participants received the conversation
  const receivedCount = results.filter(
    (result) => result && result.length > 0,
  ).length;
  const allReceived = receivedCount === participants.length;

  if (!allReceived) {
    const missing = participants
      .filter((_, index) => !results[index] || results[index].length === 0)
      .map((p) => p.name);
    console.warn(
      `[${initiator.name}] Some participants did not receive group conversation: ${missing.join(", ")}`,
    );
  }

  return {
    allReceived,
    receivedCount,
  };
}

/**
 * Verifies the order of messages received in a stream or pulled from a conversation
 *
 * @param receivedMessages - Array of received messages to check
 * @param expectedPrefix - The expected prefix for messages (e.g., 'gm-' or 'message-')
 * @param randomSuffix - The random suffix used to identify messages in this test run
 * @param expectedCount - The expected number of messages
 * @returns Object containing whether messages are in order and the expected messages
 */

// Helper function to calculate message reception and order percentages
export function calculateMessageStats(
  messagesByWorker: string[][],
  prefix: string,
  amount: number,
  suffix: string,
) {
  const verifyMessageOrder = (
    receivedMessages: string[],
    expectedPrefix: string = "gm-",
    expectedCount?: number,
  ): { inOrder: boolean; expectedMessages: string[] } => {
    // If no messages received, return early
    if (receivedMessages.length === 0) {
      return { inOrder: false, expectedMessages: [] };
    }

    // Use the provided suffix parameter directly
    const randomSuffix = suffix;

    // Determine the count of expected messages
    const count = expectedCount || receivedMessages.length;

    // Generate the expected messages in order
    const expectedMessages = Array.from(
      { length: count },
      (_, i) => `${expectedPrefix}${i + 1}-${randomSuffix}`,
    );

    // Check if received messages are in the expected order
    const inOrder =
      receivedMessages.length === expectedMessages.length &&
      receivedMessages.every((msg, index) => msg === expectedMessages[index]);

    return {
      inOrder,
      expectedMessages,
    };
  };
  const showDiscrepancies = (
    workersInOrder: number,
    workerCount: number,
    prefix: string,
    amount: number,
  ) => {
    // Log any discrepancies in message order
    if (workersInOrder < workerCount) {
      console.log("Message order discrepancies detected:");

      messagesByWorker.forEach((messages, index) => {
        const { inOrder, expectedMessages } = verifyMessageOrder(
          messages,
          prefix,
          amount,
        );

        if (!inOrder) {
          console.log(
            `Worker ${index + 1} received messages out of order or missing messages:`,
          );

          // Check for missing messages
          if (messages.length !== expectedMessages.length) {
            console.log(
              `  Expected ${expectedMessages.length} messages, received ${messages.length}`,
            );
          }

          // Find specific discrepancies
          const discrepancies = [];

          // Check for messages in wrong order or missing
          for (
            let i = 0;
            i < Math.max(messages.length, expectedMessages.length);
            i++
          ) {
            if (i >= messages.length) {
              discrepancies.push(`Missing: ${expectedMessages[i]}`);
            } else if (i >= expectedMessages.length) {
              discrepancies.push(`Unexpected: ${messages[i]}`);
            } else if (messages[i] !== expectedMessages[i]) {
              discrepancies.push(
                `Expected: ${expectedMessages[i]}, Got: ${messages[i]}`,
              );
            }
          }

          if (discrepancies.length > 0) {
            console.debug(`Discrepancies:`);
            discrepancies.forEach((d) => {
              console.debug(d);
            });
          }
        }
      });
    }
  };
  // const showComparativeTable = (messagesByWorker: string[][]) => {
  //   console.log("Comparative Table:");
  //   messagesByWorker.forEach((messages, index) => {
  //     console.log(`Worker ${index + 1}: ${messages.join(", ")}`);
  //   });
  // };
  // Check message reception
  let totalExpectedMessages = 0;
  let totalReceivedMessages = 0;

  // Check message order
  let workersInOrder = 0;
  const workerCount = messagesByWorker.length;

  for (const workerMessages of messagesByWorker) {
    totalExpectedMessages += amount;
    totalReceivedMessages += workerMessages.length;

    const { inOrder } = verifyMessageOrder(workerMessages, prefix, amount);

    if (inOrder) {
      workersInOrder++;
    }
  }

  const receptionPercentage =
    (totalReceivedMessages / totalExpectedMessages) * 100;
  const orderPercentage = (workersInOrder / workerCount) * 100;

  console.log("Expected messages pattern:", `${prefix}[1-${amount}]-${suffix}`);
  console.log(
    `Reception percentage: ${receptionPercentage.toFixed(2)}% (${totalReceivedMessages}/${totalExpectedMessages} messages)`,
  );
  console.log(
    `Order percentage: ${orderPercentage.toFixed(2)}% (${workersInOrder}/${workerCount} workers)`,
  );
  showDiscrepancies(workersInOrder, workerCount, prefix, amount);
  //showComparativeTable(messagesByWorker);
  return {
    receptionPercentage,
    orderPercentage,
    workersInOrder,
    workerCount,
    totalReceivedMessages,
    totalExpectedMessages,
  };
}
