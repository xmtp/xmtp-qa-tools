import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses, getInboxIds, getRandomAddress } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Dm,
  type Group,
} from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [10];
  let dm: Dm | undefined;

  let newGroup: Group;
  const POPULATE_SIZE = process.env.POPULATE_SIZE
    ? process.env.POPULATE_SIZE.split("-").map((v) => Number(v))
    : [0];
  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  let allMembers: string[] = [];
  let allMembersWithExtra: string[] = [];
  // Cumulative tracking variables
  let cumulativeGroups: Group[] = [];

  setupTestLifecycle({
    testName,
    getCustomDuration: () => customDuration,
    setCustomDuration: (v) => {
      customDuration = v;
    },
    sendMetrics: true,
    sendDurationMetrics: true,
    networkStats: true,
  });

  for (const populateSize of POPULATE_SIZE) {
    let workers: WorkerManager;
    let creator: Worker | undefined;
    let receiver: Worker | undefined;
    it(`no-op(${populateSize}): measure no-op`, async () => {
      workers = await getWorkers(10, {
        randomNames: false,
      });
      creator = workers.get("edward")!;
      receiver = workers.get("bob")!;
      setCustomDuration(creator.initializationTime);
    });

    it(`populate(${populateSize}): measure populating a client`, async () => {
      await creator!.worker.populate(populateSize);
      const messagesAfter = await creator!.client.conversations.list();
      expect(messagesAfter.length).toBe(populateSize);
    });
    it(`create(${populateSize}): measure creating a client`, async () => {
      workers = await getWorkers(10, {
        randomNames: false,
      });
      creator = workers.get("edward")!;
      receiver = workers.get("bob")!;
      setCustomDuration(creator.initializationTime);
    });

    it(`canMessage(${populateSize}):measure canMessage`, async () => {
      const randomAddress = receiver!.address;
      if (!randomAddress) {
        throw new Error("Random client not found");
      }
      const start = Date.now();
      const canMessage = await Client.canMessage(
        [
          {
            identifier: randomAddress,
            identifierKind: IdentifierKind.Ethereum,
          },
        ],
        receiver!.env,
      );
      setCustomDuration(Date.now() - start);
      expect(canMessage.get(randomAddress.toLowerCase())).toBe(true);
    });
    it(`inboxState(${populateSize}):measure inboxState`, async () => {
      const inboxState = await creator!.client.preferences.inboxState(true);
      expect(inboxState.installations.length).toBeGreaterThan(0);
    });
    it(`newDm(${populateSize}):measure creating a DM`, async () => {
      dm = (await creator!.client.conversations.newDm(
        receiver!.client.inboxId,
      )) as Dm;
      expect(dm).toBeDefined();
      expect(dm.id).toBeDefined();
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
      console.log("consentState", consentState);
      expect(consentState).toBe(ConsentState.Allowed);
    });
    it(`stream(${populateSize}):measure receiving a gm`, async () => {
      const verifyResult = await verifyMessageStream(dm!, [receiver!]);

      sendMetric("response", verifyResult.averageEventTiming, {
        test: testName,
        metric_type: "stream",
        metric_subtype: "message",
        sdk: receiver!.sdk,
      } as ResponseMetricTags);

      setCustomDuration(verifyResult.averageEventTiming ?? streamTimeout);
      expect(verifyResult.allReceived).toBe(true);
    });

    for (const i of BATCH_SIZE) {
      it(`newGroup-${i}(${populateSize}):create a large group of ${i} members ${i}`, async () => {
        allMembersWithExtra = getInboxIds(i + 1);
        allMembers = allMembersWithExtra.slice(0, i);

        newGroup = (await creator!.client.conversations.newGroup([
          ...allMembers,
          ...workers.getAllButCreator().map((w) => w.client.inboxId),
        ])) as Group;
        expect(newGroup.id).toBeDefined();
        // Add current group to cumulative tracking
        cumulativeGroups.push(newGroup);
      });
      it(`newGroupByAddress-${i}(${populateSize}):create a large group of ${i} members ${i}`, async () => {
        const callMembersWithExtraWithAddress = getAddresses(i + 1);
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
      it(`streamMessage-${i}(${populateSize}):group message`, async () => {
        const verifyResult = await verifyMessageStream(
          newGroup,
          workers.getAllButCreator(),
        );
        sendMetric("response", verifyResult.averageEventTiming, {
          test: testName,
          metric_type: "stream",
          metric_subtype: "message",
          sdk: workers.getCreator().sdk,
          members: i.toString(),
          installations: i.toString(),
        } as ResponseMetricTags);

        setCustomDuration(verifyResult?.averageEventTiming ?? 0);
        expect(verifyResult.almostAllReceived).toBe(true);
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
        const extraMember = allMembersWithExtra.slice(i, i + 1);
        console.log("extraMember", extraMember);
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

        sendMetric("response", verifyResult.averageEventTiming, {
          test: testName,
          metric_type: "stream",
          metric_subtype: "message",
          sdk: workers.getCreator().sdk,
        } as ResponseMetricTags);

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
