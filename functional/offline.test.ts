import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "recovery";
loadEnv(testName);

const amountofMessages = 5;
const timeoutMax = 60000; // 1 minute timeout

describe(
  testName,
  async () => {
    let group: Group;
    let workers: WorkerManager;
    workers = await getWorkers(["random1", "random2", "random3"], testName);

    let start: number;

    const randomSuffix = Math.random().toString(36).substring(2, 10);

    setupTestLifecycle({
      expect,
      workers,
      testName,
      getStart: () => start,
      setStart: (v) => {
        start = v;
      },
    });

    beforeAll(async () => {
      try {
        group = await workers
          .get("random1")!
          .client.conversations.newGroup(
            workers.getWorkers().map((p) => p.client.inboxId),
          );
        console.log("Group created", group.id);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    it("offline_recovery: verify message recovery after disconnection", async () => {
      try {
        // Select one worker to take offline
        const offlineWorker = workers.get("random2")!; // Second worker
        const onlineWorker = workers.get("random1")!; // First worker

        console.log(`Taking ${offlineWorker.name} offline`);

        // Disconnect the selected worker
        await offlineWorker.worker.terminate();

        // Send messages from an online worker
        const conversation =
          await onlineWorker.client.conversations.getConversationById(group.id);

        console.log(
          `Sending ${amountofMessages} messages while client is offline`,
        );
        const sentMessages: string[] = [];
        for (let i = 0; i < amountofMessages; i++) {
          const message = `offline-msg-${i + 1}-${randomSuffix}`;
          await conversation?.send(message);
          sentMessages.push(message);
        }
        console.log("Sent messages");

        // Reconnect the offline worker
        console.log(`Reconnecting ${offlineWorker.name}`);
        const { client } = await offlineWorker.worker.initialize();
        offlineWorker.client = client;
        await offlineWorker.client.conversations.sync();

        // Verify message recovery
        const recoveredConversation =
          await offlineWorker.client.conversations.getConversationById(
            group.id,
          );
        await recoveredConversation?.sync();
        const messages = await recoveredConversation?.messages();

        // Filter recovered messages for the ones we sent
        const recoveredMessages = (messages ?? [])
          .map((m) => (typeof m.content === "string" ? m.content : ""))
          .filter(
            (content) =>
              content.includes("offline-msg-") &&
              content.includes(randomSuffix),
          );

        expect(recoveredMessages.length).toBe(amountofMessages);
        for (const msg of sentMessages) {
          expect(recoveredMessages).toContain(msg);
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  },
  timeoutMax,
);
