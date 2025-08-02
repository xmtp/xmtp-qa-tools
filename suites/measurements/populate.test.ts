import { getWorkers, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

describe("populate", () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0, 500, 1000, 2000];
  let uniqueNames: string[] = [];
  let workers: WorkerManager | undefined;

  const getTolerance = (expectedSize: number) =>
    Math.max(5, Math.floor(expectedSize * 0.1));

  beforeAll(async () => {
    uniqueNames = ["edward", "bob", "charlie", "alice", "diana", "fiona"];

    for (const [i, populateSize] of POPULATE_SIZE.entries()) {
      if (populateSize === 0) continue;

      const creatorName = uniqueNames[i] + populateSize.toString();
      uniqueNames[i] = creatorName;

      const coworkers = await getWorkers([creatorName]);
      const creator = coworkers.get(creatorName);
      if (!creator) {
        throw new Error(`Creator ${creatorName} not found`);
      }

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
  });

  for (const name of uniqueNames) {
    it(`check conversations for ${name}`, async () => {
      const worker = workers!.get(name);
      if (!worker) {
        throw new Error(`Worker ${name} not found`);
      }

      const conversations = await worker.client.conversations.list();
      console.log(`User ${name} has ${conversations.length} conversations`);

      const expectedSize =
        POPULATE_SIZE.find((size) => name.endsWith(size.toString())) || 0;

      if (expectedSize > 0) {
        const tolerance = getTolerance(expectedSize);
        const minExpected = expectedSize - tolerance;
        const maxExpected = expectedSize + tolerance;

        expect(conversations.length).toBeGreaterThanOrEqual(minExpected);
        expect(conversations.length).toBeLessThanOrEqual(maxExpected);
      } else {
        expect(conversations.length).toBe(expectedSize);
      }
    });
  }
});
