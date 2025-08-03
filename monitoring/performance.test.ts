import {
  sendMetric,
  type DeliveryMetricTags,
  type ResponseMetricTags,
} from "@helpers/datadog";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
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
    : [10, 50, 100, 150, 200, 250];
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
    workers = await getWorkers(6);
    creator = workers.getCreator();
    receiver = workers.getReceiver();
    setCustomDuration(creator.initializationTime);
  });
  it(`sync:measure sync`, async () => {
    await creator!.client.conversations.sync();
  });
  it(`syncAll:measure syncAll`, async () => {
    await creator!.client.conversations.syncAll();
  });

  it(`inboxState:measure inboxState`, async () => {
    await creator!.client.preferences.inboxState();
  });
  it(`canMessage:measure canMessage`, async () => {
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

  it(`newDm:measure creating a DM`, async () => {
    dm = (await creator!.client.conversations.newDm(
      receiver!.client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });
  it(`newDmByAddress:measure creating a DM`, async () => {
    const dm2 = await receiver!.client.conversations.newDmWithIdentifier({
      identifier: getRandomAddress(1)[0],
      identifierKind: IdentifierKind.Ethereum,
    });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });
  it(`getConversationById:measure getting a conversation by id`, async () => {
    const conversation =
      await creator!.client.conversations.getConversationById(dm!.id);
    expect(conversation!.id).toBe(dm!.id);
  });
  it(`send:measure sending a gm`, async () => {
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
  it(`streamMessage:measure receiving a gm`, async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver!]);

    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.allReceived).toBe(true);
  });

  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxIds(i - workers.getAll().length + 1);
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
    it(`newGroupByAddress-${i}:create a large group of ${i} members ${i}`, async () => {
      const callMembersWithExtraWithAddress = getAddresses(
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
    it(`groupsync-${i}:sync a large group of ${i} members ${i}`, async () => {
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(members.length);
    });

    it(`updateName-${i}:update the group name`, async () => {
      const newName = "Large Group";
      await newGroup.updateName(newName);
      const name = newGroup.name;
      expect(name).toBe(newName);
    });
    it(`send-${i}:measure sending a gm in a group of ${i} members`, async () => {
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      await newGroup.send(groupMessage);
      expect(groupMessage).toBeDefined();
    });
    it(`addMember-${i}:add members to a group`, async () => {
      await newGroup.addMembers([workers.getAll()[2].inboxId]);
    });
    it(`removeMembers-${i}:remove a participant from a group`, async () => {
      const previousMembers = await newGroup.members();
      await newGroup.removeMembers([
        previousMembers.filter(
          (member) => member.inboxId !== newGroup.addedByInboxId,
        )[0].inboxId,
      ]);

      const members = await newGroup.members();
      expect(members.length).toBe(previousMembers.length - 1);
    });
    it(`streamMembership-${i}: stream members of additions in ${i} member group`, async () => {
      const verifyResult = await verifyMembershipStream(
        newGroup,
        workers.getAllButCreator(),
        extraMember,
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMessage-${i}: stream members of message changes in ${i} member group`, async () => {
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

      sendMetric("delivery", verifyResult.receptionPercentage, {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "delivery",
        metric_subtype: "stream",
        conversation_type: "group",
      } as DeliveryMetricTags);

      console.log("verifyResult", JSON.stringify(verifyResult, null, 2));
      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`streamMetadata-${i}: stream members of metadata changes in ${i} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroup,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.almostAllReceived).toBe(true);
    });

    it(`sync-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomA"]);
      const clientSingleSync = singleSyncWorkers.get("randomA")!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${i}:perform cold start sync operations on ${i} member group`, async () => {
      const singleSyncWorkers = await getWorkers(["randomB"]);
      const clientSingleSync = singleSyncWorkers.get("randomB")!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
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
