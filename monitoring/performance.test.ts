import { streamTimeout } from "@helpers/client";
import {
  sendMetric,
  type DeliveryMetricTags,
  type ResponseMetricTags,
} from "@helpers/datadog";
import { sendTextCompat } from "@helpers/sdk-compat";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import {
  Client,
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Dm,
  type Group,
} from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

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
  let groupWorkers: Worker[] = [];

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
  let creator: Worker;
  let receiver: Worker;
  let dm: Dm;

  beforeAll(async () => {
    workers = await getWorkers(10, { randomNames: false });
    creator = workers.mustGetCreator();
    receiver = workers.mustGetReceiver();
  });

  it(`create: measure creating a client`, () => {
    setCustomDuration(creator.initializationTime);
  });
  it(`sync:measure sync`, async () => {
    await creator.client.conversations.sync();
  });
  it(`syncAll:measure syncAll`, async () => {
    const result = await creator.client.conversations.syncAll();
    expect(result).toBeDefined();
  });

  it(`inboxState:measure inboxState`, async () => {
    const state = await creator.client.preferences.inboxState();
    expect(state).toBeDefined();
  });
  it(`canMessage:measure canMessage`, async () => {
    const canMessage = await Client.canMessage(
      [
        {
          identifier: receiver.address,
          identifierKind: IdentifierKind.Ethereum,
        },
      ],
      receiver.env,
    );
    expect(canMessage.get(receiver.address.toLowerCase())).toBe(true);
  });

  it(`newDm:measure creating a DM`, async () => {
    dm = (await creator.client.conversations.createDm(
      receiver.client.inboxId,
    )) as Dm;
    expect(dm).toBeDefined();
    expect(dm.id).toBeDefined();
  });
  it(`newDmByAddress:measure creating a DM`, async () => {
    const dm2 = await receiver.worker.createDmWithIdentifier({
      identifier: getInboxes(1)[0].accountAddress,
      identifierKind: IdentifierKind.Ethereum,
    });

    expect(dm2).toBeDefined();
    expect(dm2.id).toBeDefined();
  });
  it(`getConversationById:measure getting a conversation by id`, async () => {
    if (!dm) {
      throw new Error("dm is undefined - the 'newDm' test must run first");
    }
    const conversation = await creator.client.conversations.getConversationById(
      dm.id,
    );
    expect(conversation!.id).toBe(dm.id);
  });
  it(`send:measure sending a gm`, async () => {
    if (!dm) {
      throw new Error("dm is undefined - the 'newDm' test must run first");
    }
    const dmId = await sendTextCompat(dm, "gm");
    expect(dmId).toBeDefined();
  });
  it(`streamMessage:measure receiving a gm`, async () => {
    if (!dm) {
      throw new Error("dm is undefined - the 'newDm' test must run first");
    }
    const verifyResult = await verifyMessageStream(dm, [receiver]);
    setCustomDuration(verifyResult.averageEventTiming);
    expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(99);
  });

  it(`setConsentStates:group consent`, async () => {
    await creator.client.preferences.setConsentStates([
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
      const workersToAdd = workers
        .getAllButCreator()
        .slice(0, i - 1 - allMembers.length);
      groupWorkers = workersToAdd;
      const membersToAdd = [
        ...allMembers.map((a) => ({
          identifier: a.accountAddress,
          identifierKind: IdentifierKind.Ethereum,
        })),
        ...workersToAdd.map((w) => ({
          identifier: w.address,
          identifierKind: IdentifierKind.Ethereum,
        })),
      ];
      newGroup = (await creator.worker.createGroupWithIdentifiers(
        membersToAdd,
      )) as Group;
      const members = await newGroup.members();
      expect(members.length).toBe(i);
      expect(newGroup.id).toBeDefined();

      // Add current group to cumulative tracking
      cumulativeGroups.push(newGroup);
    });
    it(`groupsync-${i}:sync a large group of ${i} members ${i}`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      await newGroup.sync();
      const members = await newGroup.members();
      expect(members.length).toBe(i);
    });

    it(`updateName-${i}:update the group name`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      const newName = "Large Group";
      await newGroup.updateName(newName);
      // Sync from a different client (group worker) to verify the name propagated
      const verifier = groupWorkers[0];
      await verifier.client.conversations.sync();
      const verifierConvo = await verifier.client.conversations.getConversationById(newGroup.id);
      await verifierConvo!.sync();
      expect((verifierConvo as Group).name).toBe(newName);
    });
    it(`send-${i}:measure sending a gm in a group of ${i} members`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      const groupMessage = "gm-" + Math.random().toString(36).substring(2, 15);

      const sendResult = await sendTextCompat(newGroup, groupMessage);
      expect(sendResult).toBeDefined();
    });
    it(`streamMembership-${i}: stream members of additions in ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      const verifyResult = await verifyMembershipStream(
        newGroup,
        groupWorkers,
        [extraMember.inboxId],
      );

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });
    it(`removeMembers-${i}:remove a participant from a group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      await newGroup.removeMembers([extraMember.inboxId]);
      const members = await newGroup.members();
      expect(members.find((m: any) => m.inboxId === extraMember.inboxId)).toBeUndefined();
    });
    it(`addMember-${i}:add members to a group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      await newGroup.addMembers([extraMember.inboxId]);
      const members = await newGroup.members();
      expect(members.length).toBeGreaterThan(0);
    });
    it(`streamMessage-${i}: stream members of message changes in ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      const verifyResult = await verifyMessageStream(newGroup, groupWorkers);

      sendMetric(
        "response",
        verifyResult?.averageEventTiming ?? streamTimeout,
        {
          test: testName,
          metric_type: "stream",
          metric_subtype: "message",
          sdk: workers.mustGetCreator().sdk,
        } as ResponseMetricTags,
      );

      sendMetric("delivery", verifyResult.receptionPercentage, {
        sdk: workers.mustGetCreator().sdk,
        test: testName,
        metric_type: "delivery",
        metric_subtype: "stream",
        conversation_type: "group",
      } as DeliveryMetricTags);

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });

    it(`streamMetadata-${i}: stream members of metadata changes in ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      const verifyResult = await verifyMetadataStream(newGroup, groupWorkers);

      setCustomDuration(verifyResult.averageEventTiming);
      expect(verifyResult.receptionPercentage).toBeGreaterThanOrEqual(90);
    });

    it(`sync-${i}:perform cold start sync operations on ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.mustGet(randomName).client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAll-${i}:perform cold start sync operations on ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.mustGet(randomName).client;
      await newGroup.addMembers([clientSingleSync.inboxId]);
      const start = performance.now();
      await clientSingleSync.conversations.syncAll();
      const end = performance.now();
      setCustomDuration(end - start);
    });

    it(`syncCumulative-${i}:perform cumulative sync operations on ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.mustGet(randomName).client;
      for (const group of cumulativeGroups) {
        await group.addMembers([clientSingleSync.inboxId]);
      }
      const start = performance.now();
      await clientSingleSync.conversations.sync();
      const end = performance.now();
      setCustomDuration(end - start);
    });
    it(`syncAllCumulative-${i}:perform cumulative syncAll operations on ${i} member group`, async () => {
      if (!newGroup) {
        throw new Error(
          "newGroup is undefined - the 'newGroup' test must run first",
        );
      }
      let randomName = "random" + Math.random().toString(36).substring(2, 5);
      const singleSyncWorkers = await getWorkers([randomName]);
      const clientSingleSync = singleSyncWorkers.mustGet(randomName).client;
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
