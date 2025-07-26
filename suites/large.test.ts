import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "large";
describe(testName, async () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [10, 50];
  let workers: WorkerManager;

  workers = await getWorkers(5);

  let allMembers: string[] = [];
  let allMembersWithExtra: string[] = [];
  let newGroupBetweenAll: Group;
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };

  // Cumulative sync tracking
  let cumulativeGroups: Group[] = [];

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
    sendDurationMetrics: true,
  });

  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members`, async () => {
      allMembersWithExtra = getInboxIds(i + 1);
      allMembers = allMembersWithExtra.slice(0, i);

      newGroupBetweenAll = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers,
      );

      // Add current group to cumulative tracking
      cumulativeGroups.push(newGroupBetweenAll);
    });

    it(`groupsync-${i}:sync a large group of ${i} members ${i}`, async () => {
      await newGroupBetweenAll.sync();
    });
    it(`addMember-${i}: stream members of additions in ${i} member group`, async () => {
      const extraMember = allMembersWithExtra.slice(i, i + 1);
      console.log(extraMember);
      const verifyResult = await verifyMembershipStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${i}: stream members of message changes in ${i} member group`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      sendMetric("response", verifyResult.averageEventTiming, {
        test: testName,
        metric_type: "stream",
        metric_subtype: "message",
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`updateName-${i}: stream members of metadata changes in ${i} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomA"]);
      const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomB"]);
      const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    it(`syncCumulative-${i}:perform cumulative sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomC"]);
      const clientSingleSync = singleSyncWorkers.get("randomC")!.client;
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAllCumulative-${i}:perform cumulative syncAll operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomD"]);
      const clientSingleSync = singleSyncWorkers.get("randomD")!.client;
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });
  }
});
