import { streamTimeout } from "@helpers/client";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { getRandomInboxIds } from "@inboxes/utils";
import {
  getRandomNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import {
  Client,
  ConsentEntityType,
  ConsentState,
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
    : [0, 500, 1000, 2000, 5000, 10000];
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [10];
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
    setCustomDuration: (v: number | undefined) => {
      customDuration = v;
    },
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
    it(`sync(${populateSize}):measure sync`, async () => {
      await creator!.client.conversations.sync();
    });

    it(`syncAll(${populateSize}):measure syncAll`, async () => {
      await creator!.client.conversations.syncAll();
    });

    it(`storage(${populateSize}):measure storage`, async () => {
      const storage = await creator!.worker.getSQLiteFileSizes();
      setCustomDuration(storage.dbFile);
    });
    it(`inboxState(${populateSize}):measure inboxState`, async () => {
      await creator!.client.preferences.inboxState();
    });
    it(`setConsentStates:group consent`, async () => {
      await creator!.client.preferences.setConsentStates([
        {
          entity: getRandomInboxIds(1)[0],
          entityType: ConsentEntityType.InboxId,
          state: ConsentState.Allowed,
        },
      ]);
    });
    it(`canMessage(${populateSize}):measure canMessage`, async () => {
      const canMessage = await Client.canMessage(
        [
          {
            identifier: receiver!.address,
            identifierKind: IdentifierKind.Ethereum,
          },
        ],
        receiver!.env,
      );
      expect(canMessage.get(receiver!.address.toLowerCase())).toBe(true);
    });

    it(`newDm(${populateSize}):measure creating a DM`, async () => {
      dm = (await creator!.client.conversations.newDm(
        receiver!.client.inboxId,
      )) as Dm;
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
    });
    it(`streamMessage(${populateSize}):measure receiving a gm`, async () => {
      const verifyResult = await verifyMessageStream(dm!, [receiver!]);
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.allReceived).toBe(true);
    });

    it(`getConversationById(${populateSize}):measure getting a conversation by id`, async () => {
      const conversation =
        await creator!.client.conversations.getConversationById(dm!.id);
      expect(conversation!.id).toBe(dm!.id);
    });
    it(`send(${populateSize}):measure sending a gm`, async () => {
      const dmId = await dm!.send("gm");
      expect(dmId).toBeDefined();
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
        console.warn("extraMember", extraMember);
        newGroup = (await creator!.client.conversations.newGroup([
          ...allMembers,
          ...workers.getAll().map((w) => w.client.inboxId),
        ])) as Group;
        expect(newGroup.id).toBeDefined();
        if (!newGroup.id) {
          throw new Error("Group ID is undefined, cancelling the test");
        }
        // Add current group to cumulative tracking
        cumulativeGroups.push(newGroup);
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
      it(`addAdmin-${i}(${populateSize}):add an admin to a group`, async () => {
        await newGroup.addAdmin(receiver!.client.inboxId);
      });
      it(
        `streamMembership-${i}(${populateSize}): new member added to group`,
        async () => {
          await receiver?.client.conversations.sync();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          const verifyResult = await verifyMembershipStream(
            groupByReceiver as Group,
            [creator!],
            extraMember,
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout * 5,
      );
      it(`removeMembers-${i}(${populateSize}):remove a participant from a group`, async () => {
        await newGroup.removeMembers(extraMember);
      });
      it(`addMember-${i}(${populateSize}):add members to a group`, async () => {
        await newGroup.addMembers(extraMember);
      });
      it(
        `streamMessage-${i}(${populateSize}): stream members of message changes in ${i} member group`,
        async () => {
          await receiver?.client.conversations.sync();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          console.log("groupByReceiver", groupByReceiver?.id);
          const verifyResult = await verifyMessageStream(
            groupByReceiver as Group,
            [creator!],
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout * 5,
      );

      it(
        `streamMetadata-${i}(${populateSize}): stream members of metadata changes in ${i} member group`,
        async () => {
          await receiver?.client.conversations.sync();
          const groupByReceiver =
            await receiver?.client.conversations.getConversationById(
              newGroup.id,
            );
          console.log("groupByReceiver", groupByReceiver?.id);
          const verifyResult = await verifyMetadataStream(
            groupByReceiver as Group,
            [creator!],
          );

          setCustomDuration(verifyResult.averageEventTiming);
          expect(verifyResult.almostAllReceived).toBe(true);
        },
        streamTimeout * 5,
      );
    }
  }
});
