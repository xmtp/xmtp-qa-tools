import { closeEnv, loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyStream, verifyStreamAll } from "@helpers/streams";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import {
  IdentifierKind,
  type Client,
  type Conversation,
  type Group,
} from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test configuration
const testName = "ts_fork";
loadEnv(testName);

const time = new Date().toLocaleTimeString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const testConfig = {
  testName: testName,
  workers: parseInt(process.env.WORKERS ?? "8"),
  epochs: parseInt(process.env.EPOCHS ?? "4"),
  manualUsers: {
    USER_XMTPCHAT: process.env.USER_XMTPCHAT,
    USER_CONVOS: process.env.USER_CONVOS,
    USER_CONVOS_DESKTOP: process.env.USER_CONVOS_DESKTOP,
    USER_CB_WALLET: process.env.USER_CB_WALLET,
  },
  groupId: process.env.GROUP_ID,
};

console.log(
  `[${testName}] Configuration: Workers: ${testConfig.workers}, Epochs: ${testConfig.epochs}`,
);

describe(testName, () => {
  let workers: WorkerManager;
  let creator: Worker;
  let globalGroup: Group;
  let hasFailures = false;

  beforeAll(async () => {
    try {
      // Initialize workers with a mix of different configurations
      workers = await getWorkers(testConfig.workers, testName, "message", "gm");

      creator = workers.get("fabri") as Worker;
      if (!creator) {
        throw new Error("Creator worker 'fabri' not found");
      }

      console.log(`Group creator is ${creator.name}`);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
    }
  });

  it("should initialize test group and execute fork reproduction sequence", async () => {
    try {
      const start = performance.now();
      console.time("fork-test-execution");

      const allWorkers = workers.getWorkers();

      // Combine SDK workers and manual clients
      const allClientIds = [
        ...allWorkers.map((w) => w.client.inboxId),
        ...(Object.values(testConfig.manualUsers).filter(Boolean) as string[]),
      ];

      // Create or retrieve existing test group
      globalGroup = (await getOrCreateGroup(
        creator.client,
        allClientIds,
      )) as Group;

      expect(globalGroup).toBeDefined();
      expect(globalGroup.id).toBeDefined();

      // Define test and check worker sets
      const checkWorkers = ["fabri", "eve", "charlie", "grace"];
      const testWorkers = ["bob", "alice", "dave", "joe"];

      // Initial check - mention workers to identify baseline
      await checkForForks(globalGroup, allWorkers, checkWorkers);

      // Send messages from test workers and manipulate their membership
      for (let i = 0; i < testWorkers.length; i++) {
        const currentWorker = allWorkers.find((w) => w.name === testWorkers[i]);
        if (!currentWorker) {
          throw new Error(`Worker ${testWorkers[i]} not found`);
        }

        if (currentWorker.name === creator.name) continue;

        // Send identifier message from this worker
        await sendMessageToGroup(
          currentWorker,
          globalGroup.id,
          `${currentWorker.name}:${i}`,
        );

        // Execute membership changes to trigger potential forks
        await membershipChange(
          globalGroup.id,
          creator,
          currentWorker,
          testConfig.epochs,
        );
      }

      // Final verification
      console.log("Running final fork verification...");
      await checkForForks(globalGroup, allWorkers, checkWorkers);

      // Send completion message
      await globalGroup.send(
        `${creator.name}: Test sequence completed at ${new Date().toISOString()}`,
      );

      // Verify message delivery across all participants
      const verifyResult = await verifyStreamAll(globalGroup, workers);
      console.log(
        `Final verification result: ${verifyResult.allReceived ? "All messages received" : "Messages missing"}`,
      );

      const end = performance.now();
      console.log(`Test execution completed in ${end - start}ms`);
      console.timeEnd("fork-test-execution");
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});

/**
 * Checks for forks by mentioning workers and expecting responses
 */
const checkForForks = async (
  group: Group,
  allWorkers: Worker[],
  testWorkers: string[],
) => {
  console.time("fork-check");

  // Find workers not in our test set
  let excludedWorkers = allWorkers.filter((w) => !testWorkers.includes(w.name));

  // Mention all excluded workers in a single message to check responses
  const mentionMessage = "hey " + excludedWorkers.map((w) => w.name).join(" ");
  console.log(`Sending mention message: "${mentionMessage}"`);
  await group.send(mentionMessage);

  // In a non-forked group, all mentioned workers should see and respond to the message
  // In a forked group, only workers in the same branch will respond
  console.timeEnd("fork-check");
};

/**
 * Creates a new group or retrieves existing group by ID
 */
const getOrCreateGroup = async (
  creator: Client,
  addedMembers: string[],
): Promise<Conversation> => {
  console.time("get-or-create-group");

  let group: Group;

  if (!testConfig.groupId) {
    console.log(`Creating new test group with ${addedMembers.length} members`);
    group = await creator.conversations.newGroup(addedMembers, {
      groupName: `Fork Test Group ${time}`,
      groupDescription: "Group for testing fork behavior across clients",
    });

    // Store group ID for future test runs
    appendToEnv("GROUP_ID", group.id, testConfig.testName);
  } else {
    console.log(`Retrieving existing group with ID ${testConfig.groupId}`);
    const conversation = await creator.conversations.getConversationById(
      testConfig.groupId,
    );

    if (!conversation) {
      throw new Error(`Group ${testConfig.groupId} not found`);
    }

    group = conversation as Group;
    // Update group name with current timestamp for identification
    await group.updateName(`Fork Test Group ${time}`);
  }

  // Get member count
  const members = await group.members();
  console.log(`Group ${group.id} has ${members.length} members`);

  // Send initialization message
  await group.send(`Starting fork test run at ${time}`);

  console.timeEnd("get-or-create-group");
  return group;
};

/**
 * Sends a message from a worker to the specified group
 */
const sendMessageToGroup = async (
  worker: Worker,
  groupId: string,
  message: string,
): Promise<void> => {
  console.time(`send-message-${worker.name}`);

  try {
    // Ensure worker is synced before sending
    await worker.client.conversations.sync();

    // Get group conversation
    const foundGroup =
      await worker.client.conversations.getConversationById(groupId);
    if (!foundGroup) {
      throw new Error(`Group ${groupId} not found for ${worker.name}`);
    }

    // Send message
    console.log(`${worker.name} sending: "${message}" to group ${groupId}`);
    await foundGroup.send(message);
  } catch (error) {
    console.error(
      `Error sending message from ${worker.name}:`,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    console.timeEnd(`send-message-${worker.name}`);
  }
};

/**
 * Performs membership changes to trigger potential forks
 */
const membershipChange = async (
  groupId: string,
  memberWhoAdds: Worker,
  memberToAdd: Worker,
  epochs: number,
): Promise<void> => {
  console.time(`membership-change-${memberToAdd.name}`);
  const memberInboxId = memberToAdd.client.inboxId;

  try {
    // Get group reference
    await memberWhoAdds.client.conversations.sync();
    const group = (await memberWhoAdds.client.conversations.getConversationById(
      groupId,
    )) as Group;

    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Execute add/remove cycles
    console.log(
      `${memberWhoAdds.name} will perform ${epochs} add/remove cycles for ${memberToAdd.name}`,
    );

    for (let i = 0; i < epochs; i++) {
      try {
        const epochStart = performance.now();

        // Sync group before operations
        await group.sync();

        // Remove member
        await group.removeMembers([memberInboxId]);
        console.log(`Epoch ${i + 1}: Removed ${memberToAdd.name}`);

        // Sync to ensure removal is propagated
        await group.sync();

        // Add member back
        await group.addMembers([memberInboxId]);
        console.log(`Epoch ${i + 1}: Added ${memberToAdd.name} back`);

        // Update group name to force metadata change
        await group.updateName(`Fork Test Group ${time} - Cycle ${i + 1}`);

        const epochEnd = performance.now();
        console.log(`Epoch ${i + 1} completed in ${epochEnd - epochStart}ms`);
      } catch (e) {
        console.error(
          `Error in epoch ${i + 1} for ${memberToAdd.name}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  } catch (e) {
    console.error(
      `Error managing ${memberToAdd.name} in group ${groupId}:`,
      e instanceof Error ? e.message : String(e),
    );
  } finally {
    console.timeEnd(`membership-change-${memberToAdd.name}`);
  }
};
