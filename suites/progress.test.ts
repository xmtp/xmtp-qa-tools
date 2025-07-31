import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "progress";
describe(testName, () => {
  setupTestLifecycle({
    testName,
  });
  it("populate", async () => {
    let workers = await getWorkers(100, {
      randomNames: false,
    });
    const amount = 20;
    const worker = workers.getCreator();

    // Example: Access initialization time
    console.log(
      `Creator worker "${worker.name}" took ${worker.initializationTime.toFixed(2)}ms to initialize`,
    );

    await worker.client.conversations.sync();
    const existingConvs = await worker.client.conversations.list();
    const existingConvsCount = existingConvs.length;
    await worker.worker.populate(amount);
    await worker.client.conversations.sync();
    const conversations = await worker.client.conversations.list();
    expect(conversations.length).toBe(existingConvsCount + amount);
  });

  it("should have initialization time for each worker", async () => {
    const workers = await getWorkers(5, {
      randomNames: false,
    });

    const allWorkers = workers.getAll();

    // Check that each worker has an initialization time
    allWorkers.forEach((worker, index) => {
      expect(worker.initializationTime).toBeDefined();
      expect(typeof worker.initializationTime).toBe("number");
      expect(worker.initializationTime).toBeGreaterThan(0);
      console.log(
        `Worker ${index}: ${worker.name} - Initialization time: ${worker.initializationTime.toFixed(2)}ms`,
      );
    });

    // Check that initialization times are reasonable (should be positive and not too large)
    const avgInitTime =
      allWorkers.reduce((sum, worker) => sum + worker.initializationTime, 0) /
      allWorkers.length;
    console.log(`Average initialization time: ${avgInitTime.toFixed(2)}ms`);
    expect(avgInitTime).toBeGreaterThan(0);
    expect(avgInitTime).toBeLessThan(10000); // Should be less than 10 seconds
  });
});
