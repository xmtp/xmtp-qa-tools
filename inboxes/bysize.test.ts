import { ProgressBar } from "@helpers/logger";
import { IdentifierKind } from "@helpers/versions";
import { getWorkers, type Worker } from "@workers/manager";
import { describe, it } from "vitest";

describe("bysize", () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [1];

  const getTolerance = (expectedSize: number) =>
    Math.max(5, Math.floor(expectedSize * 0.1));

  it("populate", async () => {
    for (const [, populateSize] of POPULATE_SIZE.entries()) {
      if (populateSize === 0) continue;

      const creatorName = "bysizeprev" + populateSize.toString();

      const coworkers = await getWorkers([creatorName]);
      const creator = coworkers.get(creatorName);
      if (!creator) throw new Error(`Creator ${creatorName} not found`);

      console.log(`Syncing all conversations for ${creatorName}...`);

      console.time("syncAll");
      await creator?.client.conversations.sync();
      console.timeEnd("syncAll");

      console.log(
        `Populating ${populateSize} conversations for ${creatorName}...`,
      );
      await populate(populateSize, creator);

      const conversationsAfter = await creator.client.conversations.list();
      console.log(
        `Created ${conversationsAfter.length} conversations for ${creatorName}`,
      );

      const tolerance = getTolerance(populateSize);
      const minExpected = populateSize - tolerance;
      const maxExpected = populateSize + tolerance;

      if (
        conversationsAfter.length < minExpected ||
        conversationsAfter.length > maxExpected
      ) {
        throw new Error(
          `Expected approximately ${populateSize} conversations for ${creatorName} (tolerance: ±${tolerance}), but got ${conversationsAfter.length}`,
        );
      }
    }
  });
});

async function populate(count: number, worker: Worker) {
  const messagesBefore = await worker.client.conversations.list();
  console.log(`Before: ${messagesBefore.length}`);
  console.log(`Populating ${worker.name} with ${count} conversations...`);

  if (count <= messagesBefore.length) {
    console.log(
      `Skipping populating ${worker.name} with ${count} conversations because we already have ${messagesBefore.length} conversations`,
    );
    return;
  }
  let diff = count - messagesBefore.length;

  const prefix = "random";
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(diff / BATCH_SIZE);

  console.log(
    `Preparing to create ${diff} sender workers in ${totalBatches} batches of ${BATCH_SIZE}...`,
  );

  let totalCreated = 0;
  const progressBar = new ProgressBar(
    totalBatches,
    `Populating ${worker.name}`,
  );

  // Process workers in batches to avoid resource exhaustion
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, diff);
    const batchSize = endIndex - startIndex;

    console.log(
      `Processing batch ${batchIndex + 1}/${totalBatches} (${batchSize} workers)...`,
    );

    // Create batch of workers
    const batchWorkerNames = Array.from(
      { length: batchSize },
      (_, i) => `${prefix}${startIndex + i}`,
    );

    const senders = await getWorkers(batchWorkerNames);
    const senderWorkers = senders.getAll();

    // Create conversations for this batch
    console.log(`[${worker.name}] Creating ${batchSize} conversations...`);
    let batchCreated = 0;
    let batchFailed = 0;

    await Promise.all(
      senderWorkers.map(async (sender) => {
        await sender.client.conversations.createDmWithIdentifier({
          identifier: worker.address,
          identifierKind: IdentifierKind.Ethereum,
        });
        totalCreated++;
        batchCreated++;
      }),
    );

    console.log(
      `[${worker.name}] Batch completed: ${batchCreated} created, ${batchFailed} failed`,
    );

    // Sync after each batch to ensure conversations are registered
    await worker.client.conversations.sync();

    // Update progress bar for completed batch
    progressBar.update(batchIndex + 1);

    console.log(
      `Completed batch ${batchIndex + 1}/${totalBatches} (${totalCreated}/${diff} total)`,
    );
  }

  const messagesAfter = await worker.client.conversations.list();
  console.log(`After: ${messagesAfter.length}`);

  console.log(`Done populating ${worker.name} with ${count} conversations`);
}
