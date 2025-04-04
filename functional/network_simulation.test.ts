import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import type { XmtpEnv } from "@helpers/types";
import { getWorkers, type NetworkConditions } from "@workers/manager";
import { describe, expect, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
    env: string;
  };
} = {
  convos: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    env: "dev",
  },
};

const testName = "network_simulation";
loadEnv(testName);

const workerConfigs = [
  { name: "bob", id: "a", number: "100" },
  { name: "alice", id: "b", number: "104" },
];

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

describe(testName, () => {
  let hasFailures = false;
  let groupId: string;

  for (const user of Object.keys(users)) {
    describe(`User: ${user} [${users[user].env}]`, () => {
      const workerInstances: { [key: string]: any } = {};
      const receiver = users[user].inboxId;

      it("should initialize workers with network conditions", async () => {
        try {
          console.log(
            `Setting up network simulation test for ${user}[${users[user].env}]`,
          );

          // Create workers with different network conditions
          const workers = await getWorkers(
            [
              `${workerConfigs[0].name}-${workerConfigs[0].id}-${workerConfigs[0].number}`,
              `${workerConfigs[1].name}-${workerConfigs[1].id}-${workerConfigs[1].number}`,
            ],
            testName,
            "message",
            false,
            undefined,
            users[user].env as XmtpEnv,
          );

          // Store worker instances
          workerInstances[workerConfigs[0].name] = workers.get(
            workerConfigs[0].name,
            workerConfigs[0].id,
          );
          workerInstances[workerConfigs[1].name] = workers.get(
            workerConfigs[1].name,
            workerConfigs[1].id,
          );

          // Apply network conditions
          workers.setWorkerNetworkConditions(
            workerConfigs[0].name,
            networkConditions.highLatency,
          );
          workers.setWorkerNetworkConditions(
            workerConfigs[1].name,
            networkConditions.packetLoss,
          );

          console.log("syncing all");
          await workerInstances[
            workerConfigs[0].name
          ]?.client.conversations.sync();
          await workerInstances[
            workerConfigs[1].name
          ]?.client.conversations.sync();

          // Create group with receiver
          const group = await workerInstances[
            workerConfigs[0].name
          ].client.conversations.newGroup([receiver], {
            groupName: "Network Test Group",
            groupDescription: "Group for network simulation testing",
          });
          groupId = group.id;
          console.log("Created group with ID:", groupId);
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });

      it("should send messages with network conditions", async () => {
        try {
          const group =
            await workerInstances[
              workerConfigs[0].name
            ].client.conversations.getConversationById(groupId);

          console.log("Sending message with high latency");
          await group?.send("Message from high latency worker");

          const group2 =
            await workerInstances[
              workerConfigs[1].name
            ].client.conversations.getConversationById(groupId);

          console.log("Sending message with packet loss");
          await group2?.send("Message from packet loss worker");

          // Wait for messages to be processed
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });

      it("should test disconnection simulation", async () => {
        try {
          // Apply disconnection conditions to both workers
          const workers = await getWorkers(
            [
              `${workerConfigs[0].name}-${workerConfigs[0].id}-${workerConfigs[0].number}`,
              `${workerConfigs[1].name}-${workerConfigs[1].id}-${workerConfigs[1].number}`,
            ],
            testName,
            "message",
            false,
            undefined,
            users[user].env as XmtpEnv,
          );

          workers.setWorkerNetworkConditions(
            workerConfigs[0].name,
            networkConditions.disconnection,
          );
          workers.setWorkerNetworkConditions(
            workerConfigs[1].name,
            networkConditions.disconnection,
          );

          const group =
            await workerInstances[
              workerConfigs[0].name
            ].client.conversations.getConversationById(groupId);

          console.log("Sending message with disconnection simulation");
          await group?.send("Message with disconnection simulation");

          // Wait for potential disconnections
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });

      it("should test bandwidth limitation", async () => {
        try {
          // Apply bandwidth limitation to a worker
          const workers = await getWorkers(
            [
              `${workerConfigs[0].name}-${workerConfigs[0].id}-${workerConfigs[0].number}`,
            ],
            testName,
            "message",
            false,
            undefined,
            users[user].env as XmtpEnv,
          );

          workers.setWorkerNetworkConditions(
            workerConfigs[0].name,
            networkConditions.bandwidthLimit,
          );

          const group =
            await workerInstances[
              workerConfigs[0].name
            ].client.conversations.getConversationById(groupId);

          console.log("Sending message with bandwidth limitation");
          await group?.send("Message with bandwidth limitation");

          // Wait for bandwidth-limited operations
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });

      it("should test poor connection simulation", async () => {
        try {
          // Apply poor connection conditions to a worker
          const workers = await getWorkers(
            [
              `${workerConfigs[1].name}-${workerConfigs[1].id}-${workerConfigs[1].number}`,
            ],
            testName,
            "message",
            false,
            undefined,
            users[user].env as XmtpEnv,
          );

          workers.setWorkerNetworkConditions(
            workerConfigs[1].name,
            networkConditions.poorConnection,
          );

          const group =
            await workerInstances[
              workerConfigs[1].name
            ].client.conversations.getConversationById(groupId);

          console.log("Sending message with poor connection simulation");
          await group?.send("Message with poor connection simulation");

          // Wait for poor connection operations
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });
    });
  }
});
