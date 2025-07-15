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

const BATCH_SIZE = process.env.BATCH_SIZE
  ? (JSON.parse(process.env.BATCH_SIZE) as number[])
  : [5, 10];

const testName = "large";
describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  let workers: WorkerManager;

  workers = await getWorkers(5);

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

  for (const groupSize of BATCH_SIZE) {
    it(`newGroup-${groupSize}: should create a large group of ${groupSize} participants`, async () => {
      allMembersWithExtra = getInboxIds(groupSize + 1);
      allMembers = allMembersWithExtra.slice(0, groupSize);

      newGroupBetweenAll = await workers.createGroupBetweenAll(
        "Membership Stream Test",
        allMembers,
      );
    });

    it(`addMember-${groupSize}: should notify all members of additions in ${groupSize} member group`, async () => {
      const extraMember = allMembersWithExtra.slice(groupSize, groupSize + 1);
      console.log("extraMember", extraMember);
      const verifyResult = await verifyMembershipStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${groupSize}: should notify all members of message changes in ${groupSize} member group`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`updateName-${groupSize}: should notify all members of metadata changes in ${groupSize} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroupBetweenAll,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${groupSize}: should perform cold start sync operations on ${groupSize} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomA"]);
      const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${groupSize}: should perform cold start sync operations on ${groupSize} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomB"]);
      const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
      await newGroupBetweenAll.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    // let run = 0; // Worker allocation counter
    // it(`syncAllCumulative-${groupSize}: should perform cumulative sync operations on ${groupSize} member group`, async () => {
    //   const allWorkers = workers.getAllButCreator();
    //   const workerA = allWorkers[run % allWorkers.length];
    //   await workerA.client.conversations.sync();
    // });
    // it(`syncCumulative-${groupSize}: should perform cumulative sync operations on ${groupSize} member group`, async () => {
    //   const allWorkers = workers.getAllButCreator();
    //   const workerA = allWorkers[run % allWorkers.length];
    //   await workerA.client.conversations.syncAll();
    // });
  }
});
