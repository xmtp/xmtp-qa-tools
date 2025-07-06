import { getMessageByMb } from "@helpers/client";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { afterAll, beforeAll, describe, it } from "vitest";

const testName = "m_large_installations";
describe(testName, async () => {
  let workers = await getWorkers(["creator", "small", "medium", "large", "xl"]);

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
        const message = getMessageByMb(0.1);
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

    await Promise.all([
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    ]);
    await populateInboxToSize(smallInbox, 0);
    await populateInboxToSize(mediumInbox, 50);
    await populateInboxToSize(largeInbox, 100);
    await populateInboxToSize(xlInbox, 200);

    console.log("Performing initial sync on both inboxes...");
    await Promise.all([
      workers.getAll().map((worker) => worker.client.conversations.syncAll()),
    ]);
    console.log("Initial sync completed");
  });

  it(`create measurable group after sync`, async () => {
    const memberPerGroup = 100;
    const group = await workers
      .get("creator")!
      .client.conversations.newGroup(
        workers.getAll().map((worker) => worker.client.inboxId),
      );
    const inboxIds = getInboxIds(memberPerGroup);
    for (let i = 0; i < inboxIds.length; i += 20) {
      const batch = inboxIds.slice(i, i + 20);
      await group.addMembers(batch);
    }
    for (let msgNum = 0; msgNum < 100; msgNum++) {
      const message = `Message ${msgNum + 1} in ${group.name}`;
      await group.send(message);
    }
  });

  it(`syncLarge: should perform syncAll on large (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await largeInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await largeInbox.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Large inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Large inbox db size: ${dbSizeMB}MB`);
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

  it(`syncMedium: should perform syncAll on medium (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await mediumInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await mediumInbox.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`Medium inbox sync time: ${syncTimeSeconds}s`);
    console.log(`Medium inbox db size: ${dbSizeMB}MB`);
  });

  it(`syncXL: should perform syncAll on xl (fresh) inbox`, async () => {
    const syncStart = performance.now();
    await xlInbox.client.conversations.syncAll();
    const syncTimeMs = performance.now() - syncStart;
    const syncTimeSeconds = Math.round(syncTimeMs / 1000);

    const dbSizes = await xlInbox.worker.getSQLiteFileSizes();
    const dbSizeMB = Math.round(dbSizes.total / (1024 * 1024));
    console.log(`XL inbox sync time: ${syncTimeSeconds}s`);
    console.log(`XL inbox db size: ${dbSizeMB}MB`);
  });

  afterAll(async () => {
    await workers.checkStatistics();
  });
});
