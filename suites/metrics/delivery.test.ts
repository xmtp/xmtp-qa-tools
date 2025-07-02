import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "delivery";

describe(testName, async () => {
  setupTestLifecycle({});
  const workers = await getWorkers(5, { useVersions: true });

  beforeAll(async () => {
    // Set up message streams for all workers
    workers.getAll().forEach((worker) => {
      worker.worker.startStream(typeofStream.Message);
    });
  });

  it("m_delivery_dm: should deliver messages in DM", async () => {
    const alice = workers.getCreator();
    const bob = workers.getReceiver();

    const dm = await alice.client.conversations.newDm(bob.client.inboxId);

    const verifyResult = await verifyMessageStream(
      dm,
      [bob],
      10,
      "delivery-dm-{i}-{randomSuffix}",
    );

    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.averageEventTiming).toBeLessThan(5000);
  });

  it("m_delivery_small_group: should deliver messages in small group", async () => {
    const group = await workers.createGroupBetweenAll("Delivery Test Small");

    const verifyResult = await verifyMessageStream(
      group,
      workers.getAllButCreator(),
      5,
      "delivery-small-{i}-{randomSuffix}",
    );

    expect(verifyResult.receptionPercentage).toBeGreaterThan(90);
    expect(verifyResult.averageEventTiming).toBeLessThan(10000);
  });

  it("m_delivery_medium_group: should deliver messages in medium group", async () => {
    const mediumWorkers = workers.getRandomWorkers(3);
    const group = await mediumWorkers[0].client.conversations.newGroup(
      mediumWorkers.slice(1).map((w) => w.client.inboxId),
    );

    const verifyResult = await verifyMessageStream(
      group,
      mediumWorkers.slice(1),
      8,
      "delivery-medium-{i}-{randomSuffix}",
    );

    expect(verifyResult.receptionPercentage).toBeGreaterThan(85);
    expect(verifyResult.averageEventTiming).toBeLessThan(15000);
  });

  it("m_delivery_reliability: should maintain delivery reliability under load", async () => {
    const group = await workers.createGroupBetweenAll("Reliability Test");

    // Send multiple message batches
    const batchResults = [];
    for (let batch = 0; batch < 3; batch++) {
      const verifyResult = await verifyMessageStream(
        group,
        workers.getAllButCreator(),
        5,
        `reliability-batch-${batch}-{i}-{randomSuffix}`,
      );
      batchResults.push(verifyResult);
    }

    // All batches should have good delivery rates
    batchResults.forEach((result, index) => {
      expect(result.receptionPercentage).toBeGreaterThan(80);
      console.log(`Batch ${index} delivery: ${result.receptionPercentage}%`);
    });

    const avgDeliveryRate =
      batchResults.reduce(
        (sum, result) => sum + result.receptionPercentage,
        0,
      ) / batchResults.length;

    expect(avgDeliveryRate).toBeGreaterThan(85);
  });
});
