import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import {
  IdentifierKind,
  type Dm,
  type Group,
} from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "failtoverify";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];

  let newGroup: Group;

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  let allMembers: InboxData[] = [];
  let allMembersWithExtra: InboxData[] = [];
  let cumulativeGroups: Group[] = [];

  setupDurationTracking({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    initDataDog: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let receiver: Worker | undefined;

  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(5);
    creator = workers.getCreator();
    receiver = workers.getReceiver();
    setCustomDuration(creator.initializationTime);
  });
  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxes(i - workers.getAll().length + 2);
      allMembers = allMembersWithExtra.slice(0, allMembersWithExtra.length - 2);
      const membersToAdd = [
        ...allMembers.map((a) => ({
          identifier: a.accountAddress,
          identifierKind: IdentifierKind.Ethereum,
        })),
        ...workers.getAllButCreator().map((w) => ({
          identifier: w.address,
          identifierKind: IdentifierKind.Ethereum,
        })),
      ];
      newGroup = (await creator!.client.conversations.newGroupWithIdentifiers(
        membersToAdd,
      )) as Group;
      const members = await newGroup.members();
      expect(members.length).toBe(i);
      expect(newGroup.id).toBeDefined();

      // Add current group to cumulative tracking
      cumulativeGroups.push(newGroup);
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
  }
});
