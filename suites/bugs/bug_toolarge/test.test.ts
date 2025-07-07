import { getMessageByMb } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, it } from "vitest";

const testName = "large_inbox";
describe(testName, async () => {
  // 100 members per group
  let memberPerGroup = 1;

  setupTestLifecycle({
    testName,
  });

  let workers = await getWorkers(["bob", "alice"]);

  let smallInbox: Worker;
  let mediumInbox: Worker;
  let largeInbox: Worker;
  let xlInbox: Worker;

  // Helper function to populate inbox to target size
  async function populateInboxToSize(worker: Worker, targetSizeMB: number) {
    if (targetSizeMB === 0) return; // Skip for fresh inbox

    let currentDbSizes = await worker.worker.getSQLiteFileSizes();
    let currentDbSizeMB = Math.round(currentDbSizes.total / (1024 * 1024));

    console.log(
      `Populating ${worker.name} inbox to ${targetSizeMB}MB (current: ${currentDbSizeMB}MB)`,
    );

    while (currentDbSizeMB < targetSizeMB) {
      const group = await worker.client.conversations.newGroup(getInboxIds(10));
      for (let i = 0; i < 5; i++) {
        const message = getMessageByMb(0.5);
        await group.send(message);
      }

      currentDbSizes = await worker.worker.getSQLiteFileSizes();
      currentDbSizeMB = Math.round(currentDbSizes.total / (1024 * 1024));
      console.log(`${worker.name} inbox db size: ${currentDbSizeMB}MB`);
    }

    console.log(`${worker.name} inbox populated to ${currentDbSizeMB}MB`);
  }

  beforeAll(async () => {
    smallInbox = workers.get("small")!;
    mediumInbox = workers.get("medium")!;
    largeInbox = workers.get("large")!;
    xlInbox = workers.get("xl")!;

    // Populate inboxes to target sizes
    await populateInboxToSize(smallInbox, 0); // Fresh inbox
    await populateInboxToSize(mediumInbox, 20); // 20MB
    await populateInboxToSize(largeInbox, 100); // 100MB
    await populateInboxToSize(xlInbox, 200); // 200MB

    console.log("Performing final sync on all inboxes...");

    await Promise.all(
      workers.getAll().map((worker) => {
        void worker.client.conversations.syncAll();
      }),
    );

    console.log("Initial setup completed");
  });

  it(`create group with ${memberPerGroup} members`, async () => {
    const group = await workers.createGroupBetweenAll();
    const inboxIds = getInboxIds(memberPerGroup);
    for (let i = 0; i < inboxIds.length; i += 20) {
      const batch = inboxIds.slice(i, i + 20);
      await group.addMembers(batch);
    }
    for (let msgNum = 0; msgNum < 10; msgNum++) {
      const message = getMessageByMb(0.5);
      await group.send(message);
    }
  });

  it(`syncSmall: should perform syncAll on small (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await smallInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await smallInbox.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Small inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Small inbox db size: ${dbSizeMB}MB`);
  });

  it(`syncMedium: should perform syncAll on medium (20MB) inbox`, async () => {
    const syncStart = performance.now();
    await mediumInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await mediumInbox.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Medium inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Medium inbox db size: ${dbSizeMB}MB`);
  });
});
