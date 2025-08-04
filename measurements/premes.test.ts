import { streamTimeout } from "@helpers/client";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { getRandomAddress, getRandomInboxIds } from "@inboxes/utils";
import {
  getRandomNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import {
  IdentifierKind,
  type Dm,
  type Group,
} from "version-management/client-versions";
import { describe, expect, it } from "vitest";
import { setupSummaryTable } from "./helper";

const testName = "measure";
describe(testName, () => {
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0];
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];
  const randomNames = getRandomNames(5);
  let dm: Dm | undefined;

  let newGroup: Group;
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  let allMembers: string[] = [];
  let allMembersWithExtra: string[] = [];
  let extraMember: string[] = [];
  let cumulativeGroups: Group[] = [];

  setupSummaryTable({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    createSummaryTable: true,
  });

  for (const populateSize of POPULATE_SIZE) {
    let workers: WorkerManager;
    let creator: Worker | undefined;
    let receiver: Worker | undefined;
    it(`create(${populateSize}): measure creating a client`, async () => {
      const workerNames = [...randomNames];
      let bysizeWorkerName = "";
      if (populateSize > 0) {
        bysizeWorkerName = `bysize${populateSize}`;
        workerNames.unshift(bysizeWorkerName);
      }
      workers = await getWorkers(workerNames);
      creator = workers.get(workerNames[0])!;
      receiver = workers.get(workerNames[1])!;
      setCustomDuration(creator.initializationTime);
    });

    for (const i of BATCH_SIZE) {
      it(`newGroup-${i}(${populateSize}):create a large group of ${i} members ${i}`, async () => {
        // Ensure we have at least 1 extra member to add for membership streaming test
        const extraMembersNeeded = Math.max(1, i - workers.getAll().length + 1);
        allMembersWithExtra = getRandomInboxIds(extraMembersNeeded);

        // Fix the slice logic to handle negative indices properly
        const membersForGroup = Math.max(0, i - workers.getAll().length);
        allMembers = allMembersWithExtra.slice(0, membersForGroup);
        extraMember = allMembersWithExtra.slice(membersForGroup);

        newGroup = (await creator!.client.conversations.newGroup([
          ...allMembers,
          ...workers.getAll().map((w) => w.client.inboxId),
        ])) as Group;
        expect(newGroup.id).toBeDefined();
        // Add current group to cumulative tracking
        cumulativeGroups.push(newGroup);
      });
      it(`newGroupByAddress-${i}(${populateSize}):create a large group of ${i} members ${i}`, async () => {
        const callMembersWithExtraWithAddress = getRandomAddress(
          i - workers.getAll().length + 1,
        );
        const newGroupByIdentifier =
          await creator!.client.conversations.newGroupWithIdentifiers(
            callMembersWithExtraWithAddress.map((address) => ({
              identifier: address,
              identifierKind: IdentifierKind.Ethereum,
            })),
          );
        expect(newGroupByIdentifier.id).toBeDefined();
      });
      it(`groupsync-${i}(${populateSize}):sync a large group of ${i} members ${i}`, async () => {
        await newGroup.sync();
        const members = await newGroup.members();
        expect(members.length).toBe(members.length);
      });

      it(`updateName-${i}(${populateSize}):update the group name`, async () => {
        const newName = "Large Group";
        await newGroup.updateName(newName);
        const name = newGroup.name;
        expect(name).toBe(newName);
      });
      it(`send-${i}(${populateSize}):measure sending a gm in a group of ${i} members`, async () => {
        const groupMessage =
          "gm-" + Math.random().toString(36).substring(2, 15);

        await newGroup.send(groupMessage);
        expect(groupMessage).toBeDefined();
      });
      it(
        `streamMembership-${i}(${populateSize}): stream members of additions in ${i} member group`,
        async () => {
          await receiver?.client.conversations.syncAll();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          const verifyResult = await verifyMembershipStream(
            groupByReceiver as Group,
            [workers.getCreator()],
            extraMember,
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout,
      );

      it(
        `streamMessage-${i}(${populateSize}): stream members of message changes in ${i} member group`,
        async () => {
          await receiver?.client.conversations.syncAll();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          console.log("groupByReceiver", groupByReceiver?.id);
          const verifyResult = await verifyMessageStream(
            groupByReceiver as Group,
            [workers.getCreator()],
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout,
      );

      it(
        `streamMetadata-${i}(${populateSize}): stream members of metadata changes in ${i} member group`,
        async () => {
          await receiver?.client.conversations.syncAll();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          console.log("groupByReceiver", groupByReceiver?.id);
          const verifyResult = await verifyMetadataStream(
            groupByReceiver as Group,
            [workers.getCreator()],
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout,
      );

      it(`addMember-${i}(${populateSize}):add members to a group`, async () => {
        await newGroup.addMembers([workers.getAll()[2].inboxId]);
      });
      it(`removeMembers-${i}(${populateSize}):remove a participant from a group`, async () => {
        const previousMembers = await newGroup.members();
        await newGroup.removeMembers([
          previousMembers.filter(
            (member) => member.inboxId !== newGroup.addedByInboxId,
          )[0].inboxId,
        ]);

        const members = await newGroup.members();
        expect(members.length).toBe(previousMembers.length - 1);
      });
      it(`sync-${i}(${populateSize}):perform cold start sync operations on ${i} member group`, async () => {
        const singleSyncWorkers = await getWorkers(["randomA"]);
        const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
        await newGroup.addMembers([clientSingleSync.inboxId]);
        const start = performance.now();
        await clientSingleSync.conversations.sync();
        const end = performance.now();
        setCustomDuration(end - start);
      });
      it(`syncAll-${i}(${populateSize}):perform cold start sync operations on ${i} member group`, async () => {
        const singleSyncWorkers = await getWorkers(["randomB"]);
        const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
        await newGroup.addMembers([clientSingleSync.inboxId]);
        const start = performance.now();
        await clientSingleSync.conversations.syncAll();
        const end = performance.now();
        setCustomDuration(end - start);
      });
    }
  }
});
