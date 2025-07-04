import { verifyMessageStream } from "@helpers/streams";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { type Dm, type Group } from "@xmtp/node-sdk";

export interface SimplifiedTestConfig {
  testName: string;
  workerNames?: string[];
  workerCount?: number;
  useVersions?: boolean;
}

export interface SimplifiedGroupTestResult {
  group: Group;
  workers: WorkerManager;
  sendAndVerifyMessage: (message?: string) => Promise<boolean>;
  addMember: (memberName: string) => Promise<void>;
  removeMember: (memberName: string) => Promise<void>;
  updateGroupDetails: (name?: string, description?: string) => Promise<void>;
}

export interface SimplifiedDmTestResult {
  dm: Dm;
  workers: WorkerManager;
  sendAndVerifyMessage: (message?: string) => Promise<boolean>;
}

/**
 * Simplified test setup for group conversations
 * Reduces boilerplate and provides common operations
 */
export async function setupSimplifiedGroupTest(
  config: SimplifiedTestConfig,
): Promise<SimplifiedGroupTestResult> {
  // Get workers with sensible defaults
  const workerNames = config.workerNames || ["alice", "bob", "charlie", "dave"];
  const workers = await getWorkers(workerNames, {
    useVersions: config.useVersions ?? false,
  });

  // Create group with all workers except creator
  const memberInboxIds = workers
    .getAllButCreator()
    .map((w) => w.client.inboxId);
  const group = (await workers
    .getCreator()
    .client.conversations.newGroup(memberInboxIds)) as Group;

  // Start message streams for all participants
  workers.getAllButCreator().forEach((worker) => {
    worker.worker.startStream(typeofStream.Message);
  });

  return {
    group,
    workers,

    // Simplified message sending and verification
    sendAndVerifyMessage: async (message?: string) => {
      const testMessage = message || `test-${Date.now()}`;
      await group.send(testMessage);

      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
        1,
        testMessage,
      );

      return verifyResult.allReceived;
    },

    // Simplified member management
    addMember: async (memberName: string) => {
      const member = workers.get(memberName);
      if (!member) throw new Error(`Worker ${memberName} not found`);

      await group.addMembers([member.client.inboxId]);
      await group.sync();
    },

    removeMember: async (memberName: string) => {
      const member = workers.get(memberName);
      if (!member) throw new Error(`Worker ${memberName} not found`);

      await group.removeMembers([member.client.inboxId]);
      await group.sync();
    },

    // Simplified group metadata updates
    updateGroupDetails: async (name?: string, description?: string) => {
      if (name) await group.updateName(name);
      if (description) await group.updateDescription(description);
      await group.sync();
    },
  };
}

/**
 * Simplified test setup for DM conversations
 * Reduces boilerplate for common DM testing patterns
 */
export async function setupSimplifiedDmTest(
  config: SimplifiedTestConfig & { sender?: string; receiver?: string },
): Promise<SimplifiedDmTestResult> {
  const workerNames = config.workerNames || ["alice", "bob"];
  const workers = await getWorkers(workerNames, {
    useVersions: config.useVersions ?? false,
  });

  const senderName = config.sender || "alice";
  const receiverName = config.receiver || "bob";

  const sender = workers.get(senderName);
  const receiver = workers.get(receiverName);

  if (!sender || !receiver) {
    throw new Error(`Workers ${senderName} or ${receiverName} not found`);
  }

  // Create DM conversation
  const dm = (await sender.client.conversations.newDm(
    receiver.client.inboxId,
  )) as Dm;

  // Start message stream for receiver
  receiver.worker.startStream(typeofStream.Message);

  return {
    dm,
    workers,

    // Simplified message sending and verification
    sendAndVerifyMessage: async (message?: string) => {
      const testMessage = message || `dm-test-${Date.now()}`;
      await dm.send(testMessage);

      const verifyResult = await verifyMessageStream(
        dm,
        [receiver],
        1,
        testMessage,
      );

      return verifyResult.allReceived;
    },
  };
}

/**
 * Utility for batch operations with simplified error handling
 */
export async function runBatchOperations<T>(
  operations: (() => Promise<T>)[],
  options: { continueOnError?: boolean; logErrors?: boolean } = {},
): Promise<T[]> {
  const results: T[] = [];
  const { continueOnError = false, logErrors = true } = options;

  for (const operation of operations) {
    try {
      const result = await operation();
      results.push(result);
    } catch (error) {
      if (logErrors) {
        console.error("Operation failed:", error);
      }

      if (!continueOnError) {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Simplified performance testing helper
 */
export async function measureOperationTime<T>(
  operation: () => Promise<T>,
  label?: string,
): Promise<{ result: T; durationMs: number }> {
  const startTime = Date.now();
  const result = await operation();
  const durationMs = Date.now() - startTime;

  if (label) {
    console.log(`${label} completed in ${durationMs}ms`);
  }

  return { result, durationMs };
}
