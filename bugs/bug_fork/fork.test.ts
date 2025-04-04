import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import type { Worker, XmtpEnv } from "@helpers/types";
import { getWorkers, type NetworkConditions } from "@workers/manager";
import { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
    env: string;
  };
} = {
  // cb: {
  //   inboxId: "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
  //   env: "production",
  // },

  xmtpchat: {
    inboxId: "dc85c4016ededfe9745c8eb623fc7473be85498bfd70703300d99dc29e10f235",
    env: "dev",
  },
  convos: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    env: "dev",
  },
};

const testName = "bug_fork";
loadEnv(testName);

// Define worker names and IDs
const workerNames = [
  "bob",
  "alice",
  "ivy",
  "jack",
  "charlie",
  "dave",
  "eve",
  "frank",
];
const workerIds = ["a", "b", "c", "d", "e", "f", "g", "h"];

// Network condition presets for testing
const networkConditions: Record<string, NetworkConditions> = {
  highLatency: {
    latencyMs: 1000,
    jitterMs: 200,
  },
  packetLoss: {
    packetLossRate: 0.3,
  },
  disconnection: {
    disconnectProbability: 0.2,
    disconnectDurationMs: 5000,
  },
  bandwidthLimit: {
    bandwidthLimitKbps: 100,
  },
  poorConnection: {
    latencyMs: 500,
    jitterMs: 100,
    packetLossRate: 0.1,
    bandwidthLimitKbps: 200,
  },
};

// Function to get random version between 100 and 104
const getRandomVersion = () => {
  return Math.floor(Math.random() * 5) + 100; // Random number between 100 and 104
};

// Function to get random network condition
const getRandomNetworkCondition = (): NetworkConditions => {
  const conditionKeys = Object.keys(networkConditions);
  const randomIndex = Math.floor(Math.random() * conditionKeys.length);
  const key = conditionKeys[randomIndex];
  return networkConditions[key];
};

// Function to get random message
const getRandomMessage = () => {
  const messages = [
    "Hello everyone!",
    "Testing group functionality",
    "Checking message delivery",
    "Random message for testing",
    "Testing network conditions",
    "Checking version compatibility",
    "Testing group forking",
    "Message with special characters: !@#$%^&*()",
    "Long message with lots of text to test bandwidth limitations and how the system handles larger payloads under different network conditions",
    "Message with emojis: 😀 🚀 🌍 🔥 💯",
  ];
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};

describe(testName, () => {
  let hasFailures = false;
  let groupId: string;
  const workerInstances: { [key: string]: Worker } = {};
  const numWorkers = 6; // Number of workers to create

  // Function to send random message from a worker
  const sendRandomMessage = async (workerName: string, groupId: string) => {
    try {
      const group =
        await workerInstances[
          workerName
        ].client.conversations.getConversationById(groupId);

      if (group) {
        const message = getRandomMessage();
        console.log(
          `${workerName} sending message: "${message}" to group ${groupId}`,
        );
        await group.send(message);
        return true;
      } else {
        console.warn(`${workerName} could not find group ${groupId}`);
        return false;
      }
    } catch (e) {
      console.error(`Error sending message from ${workerName}:`, e);
      return false;
    }
  };

  it("should initialize first worker and create group", async () => {
    try {
      console.log(`Setting up test for convos[${users.convos.env}]`);

      // Create first worker with version 100
      const firstWorkerName = workerNames[0];
      const firstWorkerId = workerIds[0];
      const firstWorkerVersion = "100";

      const workers = await getWorkers(
        [`${firstWorkerName}-${firstWorkerId}-${firstWorkerVersion}`],
        testName,
        "message",
        false,
        undefined,
        users.convos.env as XmtpEnv,
      );

      workerInstances[firstWorkerName] = workers.get(
        firstWorkerName,
        firstWorkerId,
      ) as Worker;

      console.log("Syncing conversations");
      await workerInstances[firstWorkerName]?.client.conversations.sync();

      // Create group with receiver
      const group = await workerInstances[
        firstWorkerName
      ].client.conversations.newGroup(
        [users.convos.inboxId, users.xmtpchat.inboxId],
        {
          groupName: "Fork Test Group",
          groupDescription:
            "Group for fork testing with different versions and network conditions",
        },
      );

      groupId = group.id;
      console.log("Created group with ID:", groupId);
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to initialize first worker and create group");
      }
    }
  });

  it("should initialize random workers with different versions and network conditions", async () => {
    try {
      // Create random workers with different versions and network conditions
      const workerConfigs = [];

      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];
        const workerId = workerIds[i];
        const workerVersion = getRandomVersion().toString();

        workerConfigs.push(`${workerName}-${workerId}-${workerVersion}`);
      }

      console.log("Creating workers with configs:", workerConfigs);

      const workers = await getWorkers(
        workerConfigs,
        testName,
        "message",
        false,
        undefined,
        users.convos.env as XmtpEnv,
      );

      // Store worker instances and apply random network conditions
      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];
        const workerId = workerIds[i];

        workerInstances[workerName] = workers.get(
          workerName,
          workerId,
        ) as Worker;

        // Apply random network condition
        const networkCondition = getRandomNetworkCondition();
        workers.setWorkerNetworkConditions(workerName, networkCondition);

        console.log(`Applied network condition to ${workerName}`);
      }

      // Sync all workers
      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];
        console.log(`Syncing ${workerName}`);
        await workerInstances[workerName]?.client.conversations.sync();

        // Have each worker send a random message after syncing
        await sendRandomMessage(workerName, groupId);
      }

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to initialize random workers");
      }
    }
  });

  it("should attempt to fork the group with different workers", async () => {
    try {
      // Each worker will try to send a message to the group
      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];

        // Send a random message
        await sendRandomMessage(workerName, groupId);

        // Add a small delay between messages to simulate real-world conditions
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to fork the group with different workers");
      }
    }
  });

  it("should terminate and restart workers to test recovery", async () => {
    try {
      // Randomly select workers to terminate and restart
      const workersToRestart = Math.floor(Math.random() * (numWorkers - 1)) + 1;
      const selectedWorkers: number[] = [];

      for (let i = 0; i < workersToRestart; i++) {
        const randomIndex = Math.floor(Math.random() * (numWorkers - 1)) + 1;
        if (!selectedWorkers.includes(randomIndex)) {
          selectedWorkers.push(randomIndex);
        }
      }

      // Have all workers send messages before termination
      console.log("Sending messages before worker termination");
      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        await sendRandomMessage(workerName, groupId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Terminate and restart selected workers
      for (const workerIndex of selectedWorkers) {
        const workerName = workerNames[workerIndex];
        console.warn(
          `${workerName} terminates, deletes local data, and restarts`,
        );
        await workerInstances[workerName]?.worker.clearDB();
        await workerInstances[workerName]?.worker.initialize();
      }

      // Wait for workers to restart
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Have all workers send messages after restart
      console.log("Sending messages after worker restart");
      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        await sendRandomMessage(workerName, groupId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to terminate and restart workers");
      }
    }
  });

  // Add a new test to simulate concurrent message sending
  it("should simulate concurrent message sending from all workers", async () => {
    try {
      console.log("Simulating concurrent message sending from all workers");

      // Create an array of promises for concurrent message sending
      const messagePromises = [];

      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        messagePromises.push(sendRandomMessage(workerName, groupId));
      }

      // Wait for all messages to be sent concurrently
      await Promise.all(messagePromises);

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to simulate concurrent message sending");
      }
    }
  });

  // Add a new test to verify message consistency across workers
  it("should verify message consistency across all workers", async () => {
    try {
      console.log("Verifying message consistency across all workers");

      // First, have all workers sync to ensure they have the latest messages
      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        console.log(`Syncing ${workerName} before verification`);
        await workerInstances[workerName]?.client.conversations.sync();
      }

      // Get messages from the first worker to use as reference
      const firstWorkerName = workerNames[0];
      const firstWorkerGroup =
        await workerInstances[
          firstWorkerName
        ].client.conversations.getConversationById(groupId);

      if (!firstWorkerGroup) {
        throw new Error(`First worker could not find group ${groupId}`);
      }

      const referenceMessages = await firstWorkerGroup.messages();
      console.log(
        `Reference worker (${firstWorkerName}) has ${referenceMessages.length} messages`,
      );

      // Log the first few messages for debugging
      for (let i = 0; i < Math.min(5, referenceMessages.length); i++) {
        console.log(`Reference message ${i}: ${referenceMessages[i].content}`);
      }

      // Check each worker's messages against the reference
      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];
        const workerGroup =
          await workerInstances[
            workerName
          ].client.conversations.getConversationById(groupId);

        if (!workerGroup) {
          console.warn(`${workerName} could not find group ${groupId}`);
          continue;
        }

        const workerMessages = await workerGroup.messages();
        console.log(`${workerName} has ${workerMessages.length} messages`);

        // Check if the number of messages matches
        if (workerMessages.length !== referenceMessages.length) {
          console.warn(
            `Message count mismatch: ${workerName} has ${workerMessages.length} messages, reference has ${referenceMessages.length}`,
          );

          // Log the first few messages for debugging
          for (let j = 0; j < Math.min(5, workerMessages.length); j++) {
            console.log(
              `${workerName} message ${j}: ${workerMessages[j].content}`,
            );
          }
        } else {
          console.log(
            `${workerName} has the correct number of messages (${workerMessages.length})`,
          );
        }

        // Check if the content of messages matches
        let contentMismatch = false;
        for (
          let j = 0;
          j < Math.min(referenceMessages.length, workerMessages.length);
          j++
        ) {
          if (referenceMessages[j].content !== workerMessages[j].content) {
            console.warn(`Content mismatch at message ${j}:`);
            console.warn(`Reference: ${referenceMessages[j].content}`);
            console.warn(`${workerName}: ${workerMessages[j].content}`);
            contentMismatch = true;
          }
        }

        if (!contentMismatch) {
          console.log(`${workerName} has matching message content`);
        }
      }

      // Wait for any pending operations
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to verify message consistency");
      }
    }
  });

  // Add a new test to test membership changes
  it("should test removing and adding members to the group", async () => {
    try {
      console.log("Testing membership changes in the group");

      // First, have all workers sync to ensure they have the latest state
      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        console.log(`Syncing ${workerName} before membership changes`);
        await workerInstances[workerName]?.client.conversations.sync();
      }

      // Get the group from the first worker
      const firstWorkerName = workerNames[0];
      const firstWorkerGroup =
        await workerInstances[
          firstWorkerName
        ].client.conversations.getConversationById(groupId);

      if (!firstWorkerGroup) {
        throw new Error(`First worker could not find group ${groupId}`);
      }

      // Get current members
      const currentMembers = await firstWorkerGroup.members();
      console.log(`Current group has ${currentMembers.length} members`);

      // Randomly select a worker to remove (if there are more than 2 members)
      if (currentMembers.length > 2) {
        // Find a member that is not the first worker or the receiver
        const removableMembers = currentMembers.filter(
          (member) =>
            member.inboxId.toLowerCase() !==
              workerInstances[firstWorkerName].client.inboxId.toLowerCase() &&
            member.inboxId.toLowerCase() !==
              users.convos.inboxId.toLowerCase() &&
            member.inboxId.toLowerCase() !==
              users.xmtpchat.inboxId.toLowerCase(),
        );

        if (removableMembers.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * removableMembers.length,
          );
          const memberToRemove = removableMembers[randomIndex];

          console.log(
            `Removing member ${memberToRemove.inboxId} from the group`,
          );
          if (firstWorkerGroup instanceof Group) {
            await firstWorkerGroup.removeMembers([memberToRemove.inboxId]);
          } else {
            console.warn("First worker group is not a Group instance");
          }

          // Wait for the removal to propagate
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Have all workers send messages after removal
          console.log("Sending messages after member removal");
          for (let i = 0; i < numWorkers; i++) {
            const workerName = workerNames[i];
            await sendRandomMessage(workerName, groupId);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // Wait for messages to be processed
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      // Add a new member (the first worker's inbox ID)
      const newMemberInboxId = workerInstances[firstWorkerName].client.inboxId;
      console.log(`Adding member ${newMemberInboxId} to the group`);
      if (firstWorkerGroup instanceof Group) {
        await firstWorkerGroup.addMembers([newMemberInboxId]);
      } else {
        console.warn("First worker group is not a Group instance");
      }

      // Wait for the addition to propagate
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Have all workers send messages after adding a member
      console.log("Sending messages after adding a member");
      for (let i = 0; i < numWorkers; i++) {
        const workerName = workerNames[i];
        await sendRandomMessage(workerName, groupId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify message consistency after membership changes
      console.log("Verifying message consistency after membership changes");

      // Get updated members
      const updatedMembers = await firstWorkerGroup.members();
      console.log(`Group now has ${updatedMembers.length} members`);

      // Get messages from the first worker to use as reference
      const referenceMessages = await firstWorkerGroup.messages();
      console.log(
        `Reference worker (${firstWorkerName}) has ${referenceMessages.length} messages`,
      );

      // Check each worker's messages against the reference
      for (let i = 1; i < numWorkers; i++) {
        const workerName = workerNames[i];
        const workerGroup =
          await workerInstances[
            workerName
          ].client.conversations.getConversationById(groupId);

        if (!workerGroup) {
          console.warn(`${workerName} could not find group ${groupId}`);
          continue;
        }

        const workerMessages = await workerGroup.messages();
        console.log(`${workerName} has ${workerMessages.length} messages`);

        // Check if the number of messages matches
        if (workerMessages.length !== referenceMessages.length) {
          console.warn(
            `Message count mismatch: ${workerName} has ${workerMessages.length} messages, reference has ${referenceMessages.length}`,
          );
        } else {
          console.log(
            `${workerName} has the correct number of messages (${workerMessages.length})`,
          );
        }
      }

      // Wait for any pending operations
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (e) {
      hasFailures = logError(e, expect);
      if (hasFailures) {
        throw new Error("Failed to test membership changes");
      }
    }
  });
});
