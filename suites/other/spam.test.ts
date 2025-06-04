import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { formatBytes, getManualUsers, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const memberCounts = 10;
const targetSizeMB = 50;
const receiver = getManualUsers(["prod-testing"]);
const timeOut = 300000000;
const testName = "spam";
loadEnv(testName);

describe(
  testName,
  () => {
    setupTestLifecycle({ expect });

    it("should generate storage efficiency table for different group sizes", async () => {
      try {
        const name = `fabri-${memberCounts}`;
        const workers = await getWorkers(
          [name],
          testName,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
          "production",
        );
        const creator = workers.get(name);

        const memberInboxIds = [
          ...receiver.map((r) => r.inboxId as string),
          ...getRandomInboxIds(memberCounts - 1),
        ];

        let groupCount = 0;
        let currentTotalSize = await creator?.worker.getSQLiteFileSizes();

        while (
          currentTotalSize?.total &&
          currentTotalSize.total < targetSizeMB * 1024 * 1024
        ) {
          console.log(memberInboxIds);
          const group =
            await creator?.client.conversations.newGroup(memberInboxIds);
          await group?.send("hi");

          groupCount++;
          currentTotalSize = await creator?.worker.getSQLiteFileSizes();

          console.log(
            `  Created ${groupCount} groups, ${memberCounts} members, size: ${formatBytes(currentTotalSize?.total ?? 0)}`,
          );
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName || "unknown test");
        throw e;
      }
    });
  },
  timeOut,
);
