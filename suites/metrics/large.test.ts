import {
  verifyConversationStream,
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

// Configuration
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5");
const BATCH_SIZE = process.env.BATCH_SIZE
  ? (JSON.parse(process.env.BATCH_SIZE) as number[])
  : [5, 10];

const testName = "large";
describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  let workers: WorkerManager;

  workers = await getWorkers(WORKER_COUNT);

  let allMembers: string[] = [];
  let allMembersWithExtra: string[] = [];
  let newGroupBetweenAll: Group;
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

  let run = 0; // Worker allocation counter

  for (const groupSize of BATCH_SIZE) {
    it(`receiveNewConversation-${groupSize}: should create ${groupSize} member group conversation stream`, async () => {
      const verifyResult = await verifyConversationStream(
        workers.getCreator(),
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`newGroup-${groupSize}: should create a large group of ${groupSize} participants`, async () => {
      const allMembersWithExtra = getInboxIds(groupSize + 1);
      allMembers = allMembersWithExtra.slice(0, groupSize);
      newGroupBetweenAll = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers,
      );
    });
  }
});
