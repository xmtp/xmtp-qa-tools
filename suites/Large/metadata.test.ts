import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMetadataStream } from "@helpers/streams";
import { getFixedNames, getInboxIds } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import {
  m_large_BATCH_SIZE,
  m_large_TOTAL,
  m_large_WORKER_COUNT,
  saveLog,
  type SummaryEntry,
} from "./helpers";

const testName = "m_large_metadata";
loadEnv(testName);

describe(testName, async () => {
  let workers: WorkerManager;

  let newGroup: Group;

  const summaryMap: Record<number, SummaryEntry> = {};

  workers = await getWorkers(
    getFixedNames(m_large_WORKER_COUNT),
    testName,
    typeofStream.GroupUpdated,
  );

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    expect,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
  });
  for (
    let i = m_large_BATCH_SIZE;
    i <= m_large_TOTAL;
    i += m_large_BATCH_SIZE
  ) {
    it(`receiveMetadata-${i}: should create a group and measure all streams`, async () => {
      try {
        const creator = workers.getCreator();
        newGroup = (await creator.client.conversations.newGroup(
          getInboxIds(2, i),
        )) as Group;
        await newGroup.addMembers(
          workers.getAllButCreator().map((worker) => worker.inboxId),
        );
        const verifyResult = await verifyMetadataStream(
          newGroup,
          workers.getAllButCreator(),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.allReceived).toBe(true);

        // Save metrics
        summaryMap[i] = {
          ...(summaryMap[i] ?? { groupSize: i }),
          groupUpdatedStreamTimeMs: verifyResult.averageEventTiming,
        };
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }

  // Aft
  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
