import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMetadataStream } from "@helpers/streams";
import { getFixedNames, getRandomInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { verifyEpochChange } from "./helper";

const TEST_NAME = "group";
const testConfig = {
  groupsPerIteration: 5,
  iterations: 2,
  epochs: 2,
} as const;

loadEnv(TEST_NAME);

describe(TEST_NAME, () => {
  let workers: WorkerManager;
  setupTestLifecycle({ expect });

  it("should create multiple groups", async () => {
    try {
      workers = await getWorkers(
        ["bot", ...getFixedNames(10)],
        TEST_NAME,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.Both,
      );

      for (let iteration = 1; iteration <= testConfig.iterations; iteration++) {
        for (
          let groupIndex = 1;
          groupIndex <= testConfig.groupsPerIteration;
          groupIndex++
        ) {
          const creator = workers.get("bot");
          const allInboxIds = [
            ...getRandomInboxIds(10),
            ...workers.getAllBut("bot").map((w) => w.inboxId),
          ];

          const group =
            await creator!.client.conversations.newGroup(allInboxIds);
          await group.send(
            `Hello from iteration ${iteration}, group ${groupIndex}!`,
          );

          await verifyMetadataStream(
            group as Group,
            workers.getAllBut("bot"),
            1,
            `Group #${groupIndex} - Updated`,
          );

          await verifyEpochChange(workers, group.id, testConfig.epochs);
        }
      }

      await workers.checkForks();
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
