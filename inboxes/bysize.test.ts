import { getWorkers } from "@workers/manager";
import { beforeAll, describe } from "vitest";

describe("populate", () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0];

  const getTolerance = (expectedSize: number) =>
    Math.max(5, Math.floor(expectedSize * 0.1));

  beforeAll(async () => {
    for (const [, populateSize] of POPULATE_SIZE.entries()) {
      if (populateSize === 0) continue;

      const creatorName = "bysizepre1" + populateSize.toString();

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
  });
});
