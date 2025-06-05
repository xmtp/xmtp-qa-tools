import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { formatBytes, getManualUsers, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const memberCounts = [2];
const targetSizeMB = 5;
const spamUsers = getManualUsers(["fabri-convos-oneoff"]);
const testName = "spam";
loadEnv(testName);

describe(testName, () => {
  setupTestLifecycle({ expect });

  it("should generate storage efficiency table for different group sizes", async () => {
    try {
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      for (const memberCount of memberCounts) {
        console.time(`Testing ${memberCount}-member groups...`);
        console.log(`\n🔄 Testing ${memberCount}-member groups...`);

        const senderName = `sender${randomSuffix}-${memberCount}`;
        const receiverName = `receiver${randomSuffix}-${memberCount}`;
        const workers = await getWorkers(
          [senderName, receiverName],
          testName,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
          spamUsers[0].network as "local" | "dev" | "production",
        );
        const creator = workers.get(senderName);
        const receiver = workers.get(receiverName);

        const memberInboxIds = getRandomInboxIds(memberCount - 2); // -1 because creator is included
        let groupCount = 0;
        let installationSize = await creator?.worker.getSQLiteFileSizes();

        while (
          installationSize?.dbFile &&
          installationSize.dbFile < targetSizeMB * 1024 * 1024
        ) {
          const allInboxIds = [
            receiver?.inboxId as string,
            ...memberInboxIds,
            ...spamUsers.map((r) => r.inboxId),
          ];
          console.debug("allInboxIds", allInboxIds);
          const group =
            await creator?.client.conversations.newGroup(allInboxIds);
          await group?.send("hi");
          groupCount++;
          installationSize = await creator?.worker.getSQLiteFileSizes();
          console.debug(
            `  Created ${groupCount} groups of ${memberCount} members with total size: ${formatBytes(
              installationSize?.dbFile ?? 0,
            )}`,
          );
        }
        console.timeEnd(`Testing ${memberCount}-member groups...`);
      }
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
