import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type Worker } from "@workers/manager";
import { beforeAll, describe, it } from "vitest";

const testName = "m_large_installations";
describe(testName, async () => {
  let groupCount = 100;
  let memberPerGroup = 100;
  let MBAmount = 20;
  setupTestLifecycle({
    testName,
  });

  let workers = await getWorkers(["bob", "alice"]);

  let freshInbox: Worker;
  let populatedInbox: Worker;

  beforeAll(async () => {
    freshInbox = workers.get("bob")!;
    populatedInbox = workers.get("alice")!;
    await freshInbox.client.conversations.syncAll();
    await populatedInbox.client.conversations.syncAll();

    // Get database size for populated inbox
    const populatedDbSizes = await populatedInbox.worker.getSQLiteFileSizes();
    let populatedDbSizeMB = Math.round(populatedDbSizes.total / (1024 * 1024));

    while (populatedDbSizeMB < MBAmount) {
      const group = await populatedInbox.client.conversations.newGroup(
        getInboxIds(10),
      );
      for (let i = 0; i < 100; i++) {
        await group.send("Hello");
      }
      const populatedDbSizes = await populatedInbox.worker.getSQLiteFileSizes();
      populatedDbSizeMB = Math.round(populatedDbSizes.total / (1024 * 1024));
      console.log(`Populated inbox db size: ${populatedDbSizeMB}MB`);
    }

    console.log(`Setup completed - ${groupCount} groups created and synced`);
    // Initial sync to establish baseline
    console.log("Performing initial sync on both inboxes...");
    await freshInbox.client.conversations.syncAll();
    await populatedInbox.client.conversations.syncAll();
    console.log("Initial sync completed");
  });

  it(`create group with ${memberPerGroup} members`, async () => {
    const group = await workers.createGroupBetweenAll();
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

  it(`syncFresh: should perform syncAll on fresh inbox`, async () => {
    const syncFreshStart = performance.now();
    await freshInbox.client.conversations.syncAll();
    const freshSyncTimeMs = performance.now() - syncFreshStart;
    const freshSyncTimeSeconds = Math.round(freshSyncTimeMs / 1000);

    // Get database size for fresh inbox
    const freshDbSizes = await freshInbox.worker.getSQLiteFileSizes();
    const freshStats = freshInbox.client.debugInformation?.apiStatistics();
    console.log(JSON.stringify(freshStats, null, 2));
    const freshDbSizeMB = Math.round(freshDbSizes.total / (1024 * 1024));
    console.log(`Fresh inbox sync time: ${freshSyncTimeSeconds}s`);
    console.log(`Fresh inbox db size: ${freshDbSizeMB}MB`);
  });

  it(`syncPopulated: should perform syncAll on populated inbox with ${groupCount} groups`, async () => {
    const syncPopulatedStart = performance.now();
    await populatedInbox.client.conversations.syncAll();
    const populatedSyncTimeMs = performance.now() - syncPopulatedStart;
    const populatedSyncTimeSeconds = Math.round(populatedSyncTimeMs / 1000);

    // Get database size for populated inbox
    const populatedDbSizes = await populatedInbox.worker.getSQLiteFileSizes();
    const populatedStats =
      populatedInbox.client.debugInformation?.apiStatistics();
    console.log(JSON.stringify(populatedStats, null, 2));
    const populatedDbSizeMB = Math.round(
      populatedDbSizes.total / (1024 * 1024),
    );
    console.log(`Populated inbox sync time: ${populatedSyncTimeSeconds}s`);
    console.log(`Populated inbox db size: ${populatedDbSizeMB}MB`);
  });
});
