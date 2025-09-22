import {
  checkKeyPackageStatusesByInboxId,
  streamTimeout,
} from "@helpers/client";
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
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Dm,
  type Group,
} from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 10];

  let newGroup: Group;

  let customDuration: number | undefined = undefined;
  const setCustomDuration = (duration: number | undefined) => {
    customDuration = duration;
  };
  let extraMember: InboxData;
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
  let dm: Dm | undefined;
  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(5);
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
      identifier: getInboxes(1)[0].accountAddress,
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
  it(`streamMessage:measure receiving a gm`, async () => {
    const verifyResult = await verifyMessageStream(dm!, [receiver!]);
    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  });

  it(`setConsentStates:group consent`, async () => {
    await creator!.client.preferences.setConsentStates([
      {
        entity: getInboxes(1)[0].accountAddress,
        entityType: ConsentEntityType.InboxId,
        state: ConsentState.Allowed,
      },
    ]);
  });

  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxes(i - workers.getAll().length + 2, 2, i);
      allMembers = allMembersWithExtra.slice(0, allMembersWithExtra.length - 2);
      extraMember = allMembersWithExtra.at(-1)!;
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
    it(`streamMembership-${i}: stream members of additions in ${i} member group`, async () => {
      const verifyResult = await verifyMembershipStream(
        newGroup,
        workers.getAllButCreator(),
        [extraMember.inboxId],
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });
    it(`removeMembers-${i}:remove a participant from a group`, async () => {
      await newGroup.removeMembers([extraMember.inboxId]);
    });
    it(`addMember-${i}:add members to a group`, async () => {
      try {
        await newGroup.addMembers([extraMember.inboxId]);
      } catch (error) {
        console.error(
          "extraMember",
          error,
          JSON.stringify(extraMember, null, 2),
        );
      }
    });
    it(`streamMessage-${i}: stream members of message changes in ${i} member group`, async () => {
      const verifyResult = await verifyMessageStream(
        newGroup,
        workers.getAllButCreator(),
      );

      sendMetric(
        "response",
        verifyResult?.averageEventTiming ?? streamTimeout,
        {
          test: testName,
          metric_type: "stream",
          metric_subtype: "message",
          sdk: workers.getCreator().sdk,
        } as ResponseMetricTags,
      );

      sendMetric("delivery", verifyResult.receptionPercentage, {
        sdk: workers.getCreator().sdk,
        test: testName,
        metric_type: "delivery",
        metric_subtype: "stream",
        conversation_type: "group",
      } as DeliveryMetricTags);

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });

    it(`streamMetadata-${i}: stream members of metadata changes in ${i} member group`, async () => {
      const verifyResult = await verifyMetadataStream(
        newGroup,
        workers.getAllButCreator(),
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });

    it(`sync-${i}:perform cold start sync operations on ${i} member group`, async () => {
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.get(randomName)!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${i}:perform cold start sync operations on ${i} member group`, async () => {
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.get(randomName)!.client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    it(`syncCumulative-${i}:perform cumulative sync operations on ${i} member group`, async () => {
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.get(randomName)!.client;
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAllCumulative-${i}:perform cumulative syncAll operations on ${i} member group`, async () => {
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.get(randomName)!.client;
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
