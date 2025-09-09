import { streamTimeout } from "@helpers/client";
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
  ConsentEntityType,
  ConsentState,
  IdentifierKind,
  type Client,
  type Dm,
  type Group,
} from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5];

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
  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(5);
    creator = workers.getCreator();
    setCustomDuration(creator.initializationTime);
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
      console.log("extraMember", extraMember.inboxId);
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
      await newGroup.addMembers([extraMember.inboxId]);
      await checkKeyPackageStatusesByInboxId(
        creator!.client,
        extraMember.inboxId,
      );

      await newGroup.addMembers([extraMember.inboxId]);
    });
  }
});

async function checkKeyPackageStatusesByInboxId(
  client: Client,
  inboxId: string,
) {
  const installationIdsState = await client.preferences.inboxStateFromInboxIds(
    [inboxId],
    true,
  );
  const installationIds = installationIdsState[0].installations.map(
    (installation) => installation.id,
  );
  // Retrieve a map of installation id to KeyPackageStatus
  const status = (await client.getKeyPackageStatusesForInstallationIds(
    installationIds,
  )) as Record<string, any>;

  // Count valid and invalid installations
  const totalInstallations = Object.keys(status).length;
  const validInstallations = Object.values(status).filter(
    (value) => !value?.validationError,
  ).length;
  const invalidInstallations = totalInstallations - validInstallations;

  console.warn({
    inboxId,
    installationIds,
    totalInstallations,
    validInstallations,
    invalidInstallations,
    status,
  });
}
