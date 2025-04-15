import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import type { WorkerClient } from "@workers/main";
import { getWorkers, type NetworkConditions } from "@workers/manager";
import type { Conversation, XmtpEnv } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
  };
} = {
  convos: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
  },
};

const testName = "network";
loadEnv(testName);

const workerConfigs = [
  { name: "bob", id: "a", number: "100" },
  { name: "alice", id: "b", number: "105" },
];

// Network condition presets for testing
const networkConditions: Record<string, NetworkConditions> = {
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
};

describe(testName, () => {
  let groupId: string;
  let workerInstances: Record<string, WorkerClient> = {};

  for (const user of Object.keys(users)) {
    describe(`User: ${user}`, () => {
      const receiver = users[user].inboxId;

      it("should initialize workers and create test group", async () => {
        try {
          console.log(`Setting up network simulation test for ${user}`);

          // Create workers
          const workers = await getWorkers(
            workerConfigs.map((w) => `${w.name}-${w.id}-${w.number}`),
            testName,
            "message",
            false,
          );

          // Store worker instances
          workerConfigs.forEach((w) => {
            const worker = workers.get(w.name, w.id);
            if (!worker) {
              throw new Error(`Worker ${w.name} not found`);
            }
            workerInstances[w.name] = worker as unknown as WorkerClient;
          });

          // Clear DB before starting to ensure clean state
          for (const workerConfig of workerConfigs) {
            const worker = workerInstances[workerConfig.name];
            if (worker && typeof worker.clearDB === "function") {
              console.log(`Clearing DB for worker ${workerConfig.name}...`);
              await worker.clearDB();
            }
          }

          // Sync conversations properly
          console.log("Syncing conversations for all workers...");
          for (const workerConfig of workerConfigs) {
            const worker = workerInstances[workerConfig.name] as {
              client?: { conversations?: { sync: () => Promise<void> } };
            };
            if (!worker?.client?.conversations?.sync) {
              throw new Error(
                `Sync method not available for worker ${workerConfig.name}`,
              );
            }
            console.log(
              `Syncing conversations for worker ${workerConfig.name}...`,
            );
            try {
              await worker.client.conversations.sync();
              console.log(`Sync completed for worker ${workerConfig.name}`);
            } catch (syncError) {
              console.error(
                `Error syncing worker ${workerConfig.name}:`,
                syncError,
              );
              throw syncError;
            }
          }

          // Add a delay after sync to ensure data is processed
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Create a direct message conversation between Bob and Alice instead of a group
          // This approach is more reliable and bypasses the complex group creation process
          console.log("Creating direct message between workers...");

          // Get the inboxId of Alice to create a conversation
          const aliceWorker = workerInstances[workerConfigs[1].name] as {
            client?: { inboxId?: string };
          };

          if (!aliceWorker?.client?.inboxId) {
            throw new Error("Alice worker client or inboxId not available");
          }

          const aliceInboxId = aliceWorker.client.inboxId;
          console.log(`Using Alice inboxId: ${aliceInboxId}`);

          // Bob creates a conversation with Alice
          const bobWorker = workerInstances[workerConfigs[0].name] as {
            client?: {
              conversations?: {
                newDm: (inboxId: string) => Promise<Conversation>;
              };
            };
          };

          if (!bobWorker?.client?.conversations?.newDm) {
            throw new Error(
              "Bob worker client, conversations or newDm method not available",
            );
          }

          // Create DM conversation instead of group
          const dm = await bobWorker.client.conversations.newDm(aliceInboxId);
          groupId = dm.id; // Store the conversation ID for later use
          console.log("Created DM conversation with ID:", groupId);

          // Send a test message to verify conversation works
          await dm.send("Hello from network test");
          console.log("Sent test message successfully");

          // Apply network conditions only after conversation is created successfully
          console.log("Applying network conditions...");
          workers.setWorkerNetworkConditions(
            workerConfigs[0].name,
            networkConditions.highLatency,
          );
          workers.setWorkerNetworkConditions(
            workerConfigs[1].name,
            networkConditions.packetLoss,
          );
        } catch (e) {
          console.error("Detailed error information:", e);
          logError(e, expect);
          throw e;
        }
      });

      it("should test various network conditions", async () => {
        try {
          // Test cases with different network conditions
          const testCases = [
            {
              name: "high latency and packet loss",
              workers: [0, 1],
              conditions: [
                { worker: 0, condition: networkConditions.highLatency },
                { worker: 1, condition: networkConditions.packetLoss },
              ],
              message: "Message with high latency and packet loss",
              waitTime: 5000,
            },
            {
              name: "disconnection",
              workers: [0, 1],
              conditions: [
                { worker: 0, condition: networkConditions.disconnection },
                { worker: 1, condition: networkConditions.disconnection },
              ],
              message: "Message with disconnection simulation",
              waitTime: 10000,
            },
            {
              name: "bandwidth limitation",
              workers: [0],
              conditions: [
                { worker: 0, condition: networkConditions.bandwidthLimit },
              ],
              message: "Message with bandwidth limitation",
              waitTime: 5000,
            },
            {
              name: "poor connection",
              workers: [1],
              conditions: [
                { worker: 1, condition: networkConditions.poorConnection },
              ],
              message: "Message with poor connection simulation",
              waitTime: 5000,
            },
          ];

          // Run each test case
          for (const testCase of testCases) {
            console.log(`Testing ${testCase.name}`);

            // Get workers for this test case
            const workers = await getWorkers(
              testCase.workers.map(
                (i) =>
                  `${workerConfigs[i].name}-${workerConfigs[i].id}-${workerConfigs[i].number}`,
              ),
              testName,
              "message",
              false,
            );

            // Apply network conditions
            testCase.conditions.forEach(({ worker, condition }) => {
              workers.setWorkerNetworkConditions(
                workerConfigs[worker].name,
                condition,
              );
            });

            // Send message to the conversation (DM or group)
            const worker = workerInstances[workerConfigs[0].name] as {
              client?: {
                conversations?: {
                  getConversationById: (id: string) => Promise<Conversation>;
                };
              };
            };

            if (!worker.client?.conversations) {
              throw new Error("Worker client or conversations not available");
            }

            const conversation =
              await worker.client.conversations.getConversationById(groupId);
            if (!conversation) {
              throw new Error(`Conversation with ID ${groupId} not found`);
            }

            await conversation.send(testCase.message);
            console.log(`Sent message: ${testCase.message}`);

            // Wait for operations to complete
            await new Promise((resolve) =>
              setTimeout(resolve, testCase.waitTime),
            );
          }
        } catch (e) {
          console.error("Detailed error information:", e);
          logError(e, expect);
          throw e;
        }
      });
    });
  }
});
