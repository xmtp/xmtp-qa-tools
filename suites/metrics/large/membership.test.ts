import { verifyMembershipStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { type Group } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { BATCH_SIZE, MAX_GROUP_SIZE, saveLog, WORKER_COUNT } from "./helpers";

const testName = "large_membership";
describe(testName, async () => {
  let newGroup: Group;

  const summaryMap: Record<number, any> = {};

  let workers = await getWorkers(WORKER_COUNT);

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
    metrics: true,
  });

  for (let i = BATCH_SIZE; i <= MAX_GROUP_SIZE; i += BATCH_SIZE) {
    it(`receiveMembershipUpdate-${i}: should add members to ${i} member group`, async () => {
      // Initialize workers
      newGroup = await workers.createGroupBetweenAll();
      const verifyResult = await verifyMembershipStream(
        newGroup,
        workers.getAllButCreator(),
        getInboxIds(1),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);

      // Save metrics
      summaryMap[i] = {
        ...(summaryMap[i] ?? { groupSize: i }),
        addMembersTimeMs: verifyResult.averageEventTiming,
      };
    });
  }

  // After all tests have run, output a concise summary of all timings per group size
  afterAll(() => {
    saveLog(summaryMap);
  });
});
