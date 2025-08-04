import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  getBysizeWorkerName,
  getRandomAddress,
  getRandomInboxIds,
} from "@inboxes/utils";
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
    : [0, 500, 1000, 2000, 5000];
  const randomNames = getRandomNames(5);
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5];
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
        bysizeWorkerName = getBysizeWorkerName(populateSize)!;
        workerNames.unshift(bysizeWorkerName);
      }
      workers = await getWorkers(workerNames);
      creator = workers.get(workerNames[0])!;
      receiver = workers.get(workerNames[1])!;
      setCustomDuration(creator.initializationTime);
    });
    it(`sync(${populateSize}):measure sync`, async () => {
      await creator!.client.conversations.sync();
      const listConversations = await creator!.client.conversations.list();
      console.warn(
        "worker.name",
        creator!.name,
        "listConversations ",
        listConversations.length,
      );
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
      console.log(creator!.name, "is going to send a gm to", receiver!.name);
      const verifyResult = await verifyMessageStream(dm!, [receiver!]);
      console.log("verifyResult", JSON.stringify(verifyResult, null, 2));
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.allReceived).toBe(true);
    });

    it(`newDmByAddress(${populateSize}):measure creating a DM`, async () => {
      const dm2 = await receiver!.client.conversations.newDmWithIdentifier({
        identifier: getRandomAddress(1)[0],
        identifierKind: IdentifierKind.Ethereum,
      });

      expect(dm2).toBeDefined();
      expect(dm2.id).toBeDefined();
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

    it(`consent:group consent`, async () => {
      await creator!.client.preferences.setConsentStates([
        {
          entity: receiver!.client.inboxId,
          entityType: ConsentEntityType.InboxId,
          state: ConsentState.Allowed,
        },
      ]);
      const consentState = await creator!.client.preferences.getConsentState(
        ConsentEntityType.InboxId,
        receiver!.client.inboxId,
      );
      expect(consentState).toBe(ConsentState.Allowed);
    });
    for (const i of BATCH_SIZE) {
      it(`newGroup-${i}(${populateSize}):create a large group of ${i} members ${i}`, async () => {
        allMembersWithExtra = getRandomInboxIds(
          i - workers.getAll().length + 1,
        );
        allMembers = allMembersWithExtra.slice(0, i - workers.getAll().length);
        extraMember = allMembersWithExtra.slice(
          i - workers.getAll().length,
          i - workers.getAll().length + 1,
        );
        newGroup = (await creator!.client.conversations.newGroup([
          ...allMembers,
          ...workers.getAllButCreator().map((w) => w.client.inboxId),
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
      it(`streamMembership-${i}(${populateSize}): stream members of additions in ${i} member group`, async () => {
        const verifyResult = await verifyMembershipStream(
          newGroup,
          workers.getAllButCreator(),
          extraMember,
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.almostAllReceived).toBe(true);
      });

      it(`streamMessage-${i}(${populateSize}): stream members of message changes in ${i} member group`, async () => {
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getAllButCreator(),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.almostAllReceived).toBe(true);
      });

      it(`streamMetadata-${i}(${populateSize}): stream members of metadata changes in ${i} member group`, async () => {
        const verifyResult = await verifyMetadataStream(
          newGroup,
          workers.getAllButCreator(),
        );

        setCustomDuration(verifyResult.averageEventTiming);
        expect(verifyResult.almostAllReceived).toBe(true);
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

      it(`syncCumulative-${i}(${populateSize}):perform cumulative sync operations on ${i} member group`, async () => {
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
      it(`syncAllCumulative-${i}(${populateSize}):perform cumulative syncAll operations on ${i} member group`, async () => {
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
  }
});
