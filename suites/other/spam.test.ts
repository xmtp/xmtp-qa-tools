import { formatBytes } from "@helpers/client";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { describe, it } from "vitest";

const groupMemberSize = [2];
const targetSizeMB = 10;
const spamInboxIds = [
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b",
];

const testName = "spam";
describe("spam", () => {
  setupTestLifecycle({ testName });

  it("generate storage efficiency table for different group sizes", async () => {
    const workers = await getWorkers(1);
    // Note: No streams or syncs needed for this test (all were set to None)
    const creator = workers.get("bot");

    for (const memberCount of groupMemberSize) {
      console.time(`Testing ${memberCount}-member groups...`);
      console.log(`\n🔄 Testing ${memberCount}-member groups...`);

      const memberInboxIds = getRandomInboxIds(memberCount - 2); // -1 because creator is included
      let groupCount = 0;
      let installationSize = await creator?.worker.getSQLiteFileSizes();

      while (
        installationSize?.dbFile &&
        installationSize.dbFile < targetSizeMB * 1024 * 1024
      ) {
        const allInboxIds = [...memberInboxIds, ...spamInboxIds];
        const group = await creator?.client.conversations.newGroup(allInboxIds);
        await group?.send("hi");
        groupCount++;
        installationSize = await creator?.worker.getSQLiteFileSizes();
        console.log(
          `  Created ${groupCount} groups of ${memberCount} members with total size: ${formatBytes(
            installationSize?.dbFile ?? 0,
          )}`,
        );
      }
      console.timeEnd(`Testing ${memberCount}-member groups...`);
    }
  });
});
