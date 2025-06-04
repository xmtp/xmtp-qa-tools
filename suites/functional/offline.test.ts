import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { loadEnv } from "dev/helpers/client";
import { logError } from "dev/helpers/logger";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { describe, expect, it } from "vitest";

const testName = "recovery";
loadEnv(testName);

const amountofMessages = 5;

describe(testName, async () => {
  let group: Group;
  let workers: WorkerManager;
  workers = await getWorkers(["random1", "random2", "random3"], testName);

  const randomSuffix = Math.random().toString(36).substring(2, 10);

  setupTestLifecycle({ expect });

  it("offline_recovery: verify message recovery after disconnection", async () => {
    try {
      group = await workers.createGroup();
      console.log("Group created", group.id);
      // Select one worker to take offline
      const offlineWorker = workers.getReceiver(); // Second worker
      console.log("Offline worker", offlineWorker.name);
      const onlineWorker = workers.getCreator(); // First worker
      console.log("Online worker", onlineWorker.name);

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
        await offlineWorker.client.conversations.getConversationById(group.id);
      await recoveredConversation?.sync();
      const messages = await recoveredConversation?.messages();

      // Filter recovered messages for the ones we sent
      const recoveredMessages = (messages ?? [])
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .filter(
          (content) =>
            content.includes("offline-msg-") && content.includes(randomSuffix),
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
});
