import { sleep } from "@helpers/client";
import { calculateMessageStats, verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

describe("order", async () => {
  const amount = 5; // Number of messages to collect per receiver
  let workers: WorkerManager;

  workers = await getWorkers(5);

  let group: Group;
  const randomSuffix = Math.random().toString(36).substring(2, 15);

  setupTestLifecycle({});

  it("should verify message ordering accuracy when receiving messages via pull synchronization", async () => {
    group = await workers.createGroupBetweenAll();
    await group.sync();
    console.log("group", group.id);
    expect(group.id).toBeDefined();

    await sleep(1000); // Allow group propagation

    // Send test messages
    for (let i = 0; i < amount; i++) {
      await group.send(`gm-${i + 1}-${randomSuffix}`);
    }

    // Collect messages from each worker
    const messagesByWorker = await Promise.all(
      workers.getAllButCreator().map(async (worker) => {
        await worker.client.conversations.syncAll();
        const conversation =
          await worker.client.conversations.getConversationById(group.id);
        const messages = await conversation?.messages();
        if (!messages) throw new Error("Messages not found");
        return messages
          .filter(
            (m) =>
              m.contentType?.typeId === "text" &&
              (m.content as string).includes(randomSuffix),
          )
          .map((m) => m.content as string);
      }),
    );
    const stats = calculateMessageStats(
      messagesByWorker,
      "gm-",
      amount,
      randomSuffix,
    );

    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);
  });

  it("should verify message ordering accuracy when receiving messages via real-time streams", async () => {
    group = await workers.createGroupBetweenAll();
    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      10,
    );
    expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
    expect(verifyResult.orderPercentage).toBeGreaterThan(95);
  });
});
