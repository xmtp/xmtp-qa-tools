import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog, WORKER_COUNT } from "./helpers";

const testName = "large_messages";
describe(testName, async () => {
  let workers = await getWorkers(WORKER_COUNT);

  let newGroup: Group;

  const summaryMap: Record<number, any> = {};

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
  });

  // Dedicated 10-person group test (independent of batch configuration)
  it(`receiveGroupMessage-10-baseline: should deliver messages to all 10 members (baseline)`, async () => {
    const creator = workers.getCreator();
    newGroup = (await creator.client.conversations.newGroup(
      getInboxIds(10),
    )) as Group;
    await newGroup.sync();
    await newGroup.addMembers(
      workers.getAllButCreator().map((worker) => worker.client.inboxId),
    );

    await newGroup.sync();
    const verifyResult = await verifyMessageStream(
      newGroup,
      workers.getAllButCreator(),
    );

    // Save metrics with special key for baseline
    summaryMap[10] = {
      ...(summaryMap[10] ?? { groupSize: 10 }),
      messageStreamTimeMs: verifyResult.averageEventTiming,
      isBaseline: true,
    };

    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.almostAllReceived).toBe(true);
  });

  // Batch-based tests (existing behavior)
  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    it(`receiveGroupMessage-${i}: should deliver messages to all ${i}`, async () => {
      const creator = workers.getCreator();
      newGroup = (await creator.client.conversations.newGroup(
        getInboxIds(i),
      )) as Group;
      await newGroup.sync();
      await newGroup.addMembers(
        workers.getAllButCreator().map((worker) => worker.client.inboxId),
      );

      await newGroup.sync();
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );

      // Save metrics (merge with baseline if same size)
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        messageStreamTimeMs: verifyResult.averageEventTiming,
      };

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
