import { getWorkers, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

describe("populate", () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0, 10000];
  let uniqueNames: string[] = [];
  let workers: WorkerManager | undefined;

  const getTolerance = (expectedSize: number) =>
    Math.max(5, Math.floor(expectedSize * 0.1));

  beforeAll(async () => {
    uniqueNames = ["edward", "diana"];

    for (const [i, populateSize] of POPULATE_SIZE.entries()) {
      if (populateSize === 0) continue;

      const creatorName = uniqueNames[i] + populateSize.toString();
      uniqueNames[i] = creatorName;

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
      await creator.worker.populate(populateSize);

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

    // Initialize workers after populating conversations
    workers = await getWorkers(uniqueNames);
  });

  it("check all conversations", async () => {
    for (const name of uniqueNames) {
      const worker = workers!.get(name);
      if (!worker) {
        throw new Error(`Worker ${name} not found`);
      }

      const conversations = await worker.client.conversations.list();
      console.log(`User ${name} has ${conversations.length} conversations`);

      const expectedSize = (() => {
        // Sort sizes in descending order to check longest matches first
        const sortedSizes = [...POPULATE_SIZE].sort((a, b) => b - a);
        for (const size of sortedSizes) {
          if (name.endsWith(size.toString())) {
            return size;
          }
        }
        return 0;
      })();

      if (expectedSize > 0) {
        const tolerance = getTolerance(expectedSize);
        const minExpected = expectedSize - tolerance;
        const maxExpected = expectedSize + tolerance;

        expect(conversations.length).toBeGreaterThanOrEqual(minExpected);
        expect(conversations.length).toBeLessThanOrEqual(maxExpected);
      } else {
        expect(conversations.length).toBe(expectedSize);
      }
    }
  });
});
