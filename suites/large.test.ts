import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
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
  let cumulativeGroupSizes: number[] = [];

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
    sendDurationMetrics: true,
  });

  for (const groupSize of BATCH_SIZE) {
    it(`newGroup-${groupSize}:create a large group of ${groupSize} members`, async () => {
      allMembersWithExtra = getInboxIds(groupSize + 1);
      allMembers = allMembersWithExtra.slice(0, groupSize);

      newGroupBetweenAll = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers,
      );

      // Add current group to cumulative tracking
      cumulativeGroups.push(newGroupBetweenAll);
      cumulativeGroupSizes.push(groupSize);
    });

    it(`groupsync-${groupSize}:sync a large group of ${groupSize} members ${groupSize}`, async () => {
      await newGroupBetweenAll.sync();
    });
    it(`addMember-${groupSize}:notify all members of additions in ${groupSize} member group`, async () => {
      const extraMember = allMembersWithExtra.slice(groupSize, groupSize + 1);
      console.log(extraMember);
      const verifyResult = await verifyMembershipStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${groupSize}:notify all members of message changes in ${groupSize} member group`, async () => {
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

    it(`updateName-${groupSize}:notify all members of metadata changes in ${groupSize} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${groupSize}:perform cold start sync operations on ${groupSize} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomA"]);
      const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${groupSize}:perform cold start sync operations on ${groupSize} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomB"]);
      const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    // Cumulative sync tests - sync all groups created so far
    it(`cumulativeSync-${groupSize}:perform cumulative sync operations on ${cumulativeGroupSizes.reduce(
      (a, b) => a + b,
      0,
    )} total members across ${cumulativeGroups.length} groups`, async () => {
      const singleSyncWorkers = await getWorkers([
        `cumulativeWorker-${groupSize}`,
      ]);
      const clientSingleSync = singleSyncWorkers.get(
        `cumulativeWorker-${groupSize}`,
      )!.client;

      // Add worker to all cumulative groups
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }

      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();

      const totalMembers = cumulativeGroupSizes.reduce((a, b) => a + b, 0);
      setCustomDuration(end - start);

      // Send metric with cumulative info
      sendMetric("response", end - start, {
        test: testName,
        metric_type: "cumulative_sync",
        metric_subtype: "sync",
        total_groups: cumulativeGroups.length,
        total_members: totalMembers,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);
    });

    it(`cumulativeSyncAll-${groupSize}:perform cumulative syncAll operations on ${cumulativeGroupSizes.reduce(
      (a, b) => a + b,
      0,
    )} total members across ${cumulativeGroups.length} groups`, async () => {
      const singleSyncWorkers = await getWorkers([
        `cumulativeWorkerAll-${groupSize}`,
      ]);
      const clientSingleSync = singleSyncWorkers.get(
        `cumulativeWorkerAll-${groupSize}`,
      )!.client;

      // Add worker to all cumulative groups
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }

      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();

      const totalMembers = cumulativeGroupSizes.reduce((a, b) => a + b, 0);
      setCustomDuration(end - start);

      // Send metric with cumulative info
      sendMetric("response", end - start, {
        test: testName,
        metric_type: "cumulative_sync",
        metric_subtype: "syncAll",
        total_groups: cumulativeGroups.length,
        total_members: totalMembers,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);
    });
  }
});
