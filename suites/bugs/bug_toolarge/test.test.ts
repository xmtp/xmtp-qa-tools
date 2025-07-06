import { getMessageByMb } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "bug_toolarge";
describe(testName, async () => {
  // 100 members per group
  let memberPerGroup = 1;

  setupTestLifecycle({
    testName,
  });

  let workers = await getWorkers(["bob", "alice"]);

  let bob: Worker;
  let alice: Worker;

  beforeAll(async () => {
    bob = workers.get("bob")!;
    alice = workers.get("alice")!;

    console.log("Performing final sync on all inboxes...");

    // Initial sync for all inboxes
    await Promise.all(
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    );

    console.log("Initial setup completed");
  });

  it(`create group with ${memberPerGroup} members`, async () => {
    const group = await workers.createGroupBetweenAll();
    const message = getMessageByMb(0.1);
    await group.send(message);
  });

  it(`syncSmall: should perform syncAll on small (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await bob.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await bob.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Small inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Small inbox db size: ${dbSizeMB}MB`);
  });

  it(`syncMedium: should perform syncAll on medium (20MB) inbox`, async () => {
    const syncStart = performance.now();
    await alice.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await alice.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Medium inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Medium inbox db size: ${dbSizeMB}MB`);
  });
});
