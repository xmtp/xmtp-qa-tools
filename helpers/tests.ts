import fs from "fs";
import { getEnvPath } from "@helpers/client";
import type { Worker, WorkerManager } from "@workers/manager";
import { type Client, type Group } from "@xmtp/node-sdk";
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
  Client as Client202,
  Conversation as Conversation202,
  Dm as Dm202,
  Group as Group202,
} from "@xmtp/node-sdk-202";
import {
  Client as Client203,
  Conversation as Conversation203,
  Dm as Dm203,
  Group as Group203,
} from "@xmtp/node-sdk-203";
import {
  Client as ClientMls,
  Conversation as ConversationMls,
} from "@xmtp/node-sdk-mls";

export type GroupMetadataContent = {
  metadataFieldChanges: Array<{
    fieldName: string;
    newValue: string;
    oldValue: string;
  }>;
};

// Default worker names
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
  "guada", // max 61
];

export const defaultValues = {
  amount: 5,
  timeout: 40000,
  perMessageTimeout: 3000,
  defaultNames,
};

// Logging interface
export interface LogInfo {
  timestamp: string;
  level: string;
  message: string;
  [key: symbol]: string | undefined;
}
export const sdkVersionOptions = [100, 105, 202, 203];

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
  202: {
    Client: Client202,
    Conversation: Conversation202,
    Dm: Dm202,
    Group: Group202,
    sdkPackage: "node-sdk-202",
    bindingsPackage: "node-bindings-120-1",
    sdkVersion: "2.0.2",
    libXmtpVersion: "bed98df",
  },
  203: {
    Client: Client203,
    Conversation: Conversation203,
    Dm: Dm203,
    Group: Group203,
    sdkPackage: "node-sdk-203",
    bindingsPackage: "node-bindings-120-2",
    sdkVersion: "2.0.3",
    libXmtpVersion: "c24af30",
  },
};

// Network condition presets
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
  console.log(`[${worker.name}] Creating ${count} installations`);
  const initialState = await worker.client.preferences.inboxState(true);
  console.log(
    `[${worker.name}] Initial inbox state: ${JSON.stringify(initialState)}`,
  );

  for (let i = 0; i < count; i++) {
    console.log(`[${worker.name}] Creating installation ${i + 1}`);
    await worker.worker?.clearDB();
    await worker.worker?.initialize();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const finalState = await worker.client.preferences.inboxState(true);
  console.log(
    `[${worker.name}] Created ${count} installations. Final state: ${JSON.stringify(finalState)}`,
  );
  return worker;
};

/**
 * Gets a random version from the versions array
 */
export const getRandomVersion = (versions: string[]): string =>
  versions[Math.floor(Math.random() * versions.length)];

/**
 * Gets all worker inbox IDs from the test config
 */
export const getAllWorkersfromConfig = (testConfig: {
  manualUsers: Record<string, string>;
  workers: WorkerManager;
}): string[] => {
  const inboxIds = Object.values(testConfig.manualUsers);
  testConfig.workers
    .getWorkers()
    .forEach((worker) => inboxIds.push(worker.client.inboxId));
  return inboxIds;
};

/**
 * Gets a random network condition
 */
export const getRandomNetworkCondition = (): NetworkCondition => {
  const conditions = Object.keys(networkConditions) as NetworkConditionKey[];
  return networkConditions[
    conditions[Math.floor(Math.random() * conditions.length)]
  ];
};

/**
 * Gets worker configs with random versions
 */
export const getWorkerConfigs = (testConfig: {
  workerNames: string[];
  installationNames: string[];
  versions: string[];
}): string[] => {
  const { workerNames, installationNames, versions } = testConfig;
  return workerNames.map((name) => {
    const id = getRandomVersion(installationNames);
    const version = getRandomVersion(versions);
    console.log(`${name} using version: ${version}`);
    return `${name}-${id}-${version}`;
  });
};

/**
 * Randomly assigns admin privileges to a group member
 */
export const randomlyAsignAdmins = async (group: Group): Promise<void> => {
  await group.sync();
  const members = await group.members();

  if (members.length === 0) return;

  const randomMember = members[Math.floor(Math.random() * members.length)];
  const isSuperAdmin = Math.random() > 0.5;

  try {
    if (isSuperAdmin) {
      await group.addSuperAdmin(randomMember.inboxId);
      console.log(`Added ${randomMember.inboxId} as super admin`);
    } else {
      await group.addAdmin(randomMember.inboxId);
      console.log(`Added ${randomMember.inboxId} as admin`);
    }
  } catch (error) {
    console.error("Error assigning admin:", error);
  }
};

/**
 * Updates group metadata with a random member
 */
const updateGroupMetadata = async (
  group: Group,
  workers: WorkerManager,
  updateField: string,
): Promise<void> => {
  const members = await group.members();
  if (members.length === 0) return;

  const randomMember = members[Math.floor(Math.random() * members.length)];
  const newValue = `Random ${updateField} ${Math.random().toString(36).substring(2, 15)}`;

  const worker = workers
    .getWorkers()
    .find((w) => w.client.inboxId === randomMember.inboxId);
  if (!worker) return;

  const foundGroup = (await worker.client.conversations.getConversationById(
    group.id,
  )) as Group;
  if (!foundGroup) return;

  if (updateField === "name") {
    await foundGroup.updateName(newValue);
  } else if (updateField === "description") {
    await foundGroup.updateDescription(newValue);
  }

  console.log(
    `Group ${updateField} updated by ${randomMember.inboxId} to: ${newValue}`,
  );
};

/**
 * Updates group name with a random member
 */
export const randomNameUpdate = async (
  group: Group,
  workers: WorkerManager,
): Promise<void> => updateGroupMetadata(group, workers, "name");

/**
 * Updates group description with a random member
 */
export const randomDescriptionUpdate = async (
  group: Group,
  workers: WorkerManager,
): Promise<void> => updateGroupMetadata(group, workers, "description");

/**
 * Removes a member from a group
 */
export const removeMemberByWorker = async (
  groupId: string,
  memberToRemove: string,
  memberWhoRemoves: Worker,
): Promise<void> => {
  try {
    if (!memberToRemove) return;

    console.log(`Removing ${memberToRemove}`);
    const group =
      (await memberWhoRemoves.client.conversations.getConversationById(
        groupId,
      )) as Group;
    if (!group) return;

    await group.sync();
    const members = await group.members();

    if (
      !members?.some(
        (m) => m.inboxId.toLowerCase() === memberToRemove.toLowerCase(),
      )
    ) {
      console.log(`Member ${memberToRemove} not in group ${groupId}`);
      return;
    }

    // Demote if needed
    if (group.isAdmin(memberToRemove)) {
      await group.removeAdmin(memberToRemove);
    }

    if (group.isSuperAdmin(memberToRemove)) {
      await group.removeSuperAdmin(memberToRemove);
    }

    await group.removeMembers([memberToRemove]);
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
  const { workers, groupId } = testConfig;

  for (const worker of workers.getWorkers()) {
    const syncType = Math.floor(Math.random() * 3); // 0: sync, 1: syncAll, 2: group sync

    if (syncType === 0) {
      await worker.client.conversations.sync();
    } else if (syncType === 1) {
      await worker.client.conversations.syncAll();
    } else {
      const group =
        await worker.client.conversations.getConversationById(groupId);
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
    if (Math.random() < 0.5) {
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
  const testWorkers = ["bob", "alice", "ivy"];
  const conditions = testWorkers.map((name) => ({
    name,
    condition: getRandomNetworkCondition(),
  }));

  console.log("Applying network conditions:");
  conditions.forEach(({ name, condition }) => {
    console.log(`${name}: ${JSON.stringify(condition)}`);
    workers.setWorkerNetworkConditions(name, condition);
  });
};

/**
 * Sends an initial test message to the bot
 */
export const sendInitialTestMessage = async (client: Client): Promise<void> => {
  try {
    const recipients = [process.env.CONVOS_USER, process.env.CB_USER];

    for (const recipient of recipients) {
      if (!recipient) continue;
      const dm = await client.conversations.newDm(recipient);
      await dm.send("gm from bot");
      console.log(`DM sent to ${recipient}: ${dm.id}`);
    }
  } catch (error) {
    console.error("Error sending initial test message:", error);
  }
};

/**
 * Appends a variable to the .env file
 */
export const appendToEnv = (
  key: string,
  value: string,
  testName: string = "",
): void => {
  try {
    const envPath = getEnvPath(testName);

    // Update process.env
    if (key in process.env) {
      process.env[key] = value;
    }

    // Read/create .env file
    let envContent = "";
    try {
      envContent = fs.readFileSync(envPath, "utf8");
    } catch {
      console.log("Creating new .env file");
    }

    // Escape regex special chars
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

    // Update or add the key
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(
        new RegExp(`${escapedKey}=.*(\\r?\\n|$)`, "g"),
        `${key}="${value}"$1`,
      );
    } else {
      envContent += `\n${key}="${value}"\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`Updated .env with ${key}: ${value}`);
  } catch (error) {
    console.error(`Failed to update .env with ${key}:`, error);
  }
};

/**
 * Simulates a client missing cursor messages
 */
export const simulateMissingCursorMessage = async (
  worker: Worker,
): Promise<void> => {
  console.log(
    `[${worker.name}] Simulating backgrounded app missing cursor messages`,
  );
  await worker.worker?.reinstall();
  console.log(
    `[${worker.name}] Worker reinstalled but sync intentionally skipped`,
  );
  console.log(`[${worker.name}] Simulating cursor being off by one message`);
};

/**
 * Calculates message reception and order statistics
 */
export function calculateMessageStats(
  messagesByWorker: string[][],
  prefix: string,
  amount: number,
  suffix: string,
) {
  // Verify message order helper
  const verifyMessageOrder = (
    messages: string[],
    expectedPrefix: string = "gm-",
    expectedCount?: number,
  ) => {
    if (messages.length === 0) return { inOrder: false, expectedMessages: [] };

    const count = expectedCount || messages.length;
    const expectedMessages = Array.from(
      { length: count },
      (_, i) => `${expectedPrefix}${i + 1}-${suffix}`,
    );

    const inOrder =
      messages.length === expectedMessages.length &&
      messages.every((msg, i) => msg === expectedMessages[i]);

    return { inOrder, expectedMessages };
  };

  // Log discrepancies helper
  const showDiscrepancies = (workersInOrder: number, workerCount: number) => {
    if (workersInOrder >= workerCount) return;

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

        if (messages.length !== expectedMessages.length) {
          console.log(
            `  Expected ${expectedMessages.length} messages, received ${messages.length}`,
          );
        }

        const discrepancies = [];

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
          console.debug("Discrepancies:");
          discrepancies.forEach((d) => {
            console.debug(d);
          });
        }
      }
    });
  };

  // Calculate statistics
  let totalExpectedMessages = amount * messagesByWorker.length;
  let totalReceivedMessages = messagesByWorker.reduce(
    (sum, msgs) => sum + msgs.length,
    0,
  );
  let workersInOrder = 0;
  const workerCount = messagesByWorker.length;

  for (const messages of messagesByWorker) {
    const { inOrder } = verifyMessageOrder(messages, prefix, amount);
    if (inOrder) workersInOrder++;
  }

  const receptionPercentage =
    (totalReceivedMessages / totalExpectedMessages) * 100;
  const orderPercentage = (workersInOrder / workerCount) * 100;

  console.log("Expected messages pattern:", `${prefix}[1-${amount}]-${suffix}`);
  console.log(
    `Reception: ${receptionPercentage.toFixed(2)}% (${totalReceivedMessages}/${totalExpectedMessages})`,
  );
  console.log(
    `Order: ${orderPercentage.toFixed(2)}% (${workersInOrder}/${workerCount} workers)`,
  );

  showDiscrepancies(workersInOrder, workerCount);

  return {
    receptionPercentage,
    orderPercentage,
    workersInOrder,
    workerCount,
    totalReceivedMessages,
    totalExpectedMessages,
  };
}
