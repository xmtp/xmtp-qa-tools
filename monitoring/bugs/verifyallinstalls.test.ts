import "@helpers/datadog";
import { checkKeyPackageStatusesByInboxId } from "@helpers/client";
import { IdentifierKind, type Group } from "@helpers/versions";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5];

  let newGroup: Group;

  let extraMember: string;
  let allMembers: InboxData[] = [];
  let allMembersWithExtra: InboxData[] = [];
  let workers: WorkerManager;
  let creator: Worker;

  beforeAll(async () => {
    workers = await getWorkers(5);
    creator = workers.mustGetCreator();
  });

  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxes(i - workers.getAll().length + 2, 2, i);
      allMembers = allMembersWithExtra.slice(0, allMembersWithExtra.length - 2);
      extraMember = getInboxes(1)[0].inboxId;
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
      newGroup = (await creator.worker.createGroupWithIdentifiers(
        membersToAdd,
      )) as Group;
      const members = await newGroup.members();
      expect(members.length).toBe(i);
      expect(newGroup.id).toBeDefined();
    });
    it(`addMember-${i}:add members to a group`, async () => {
      await checkKeyPackageStatusesByInboxId(creator.client, extraMember);
      const membersBefore = await newGroup.members();
      await newGroup.addMembers([extraMember]);
      const membersAfter = await newGroup.members();
      expect(membersAfter.length).toBe(membersBefore.length + 1);
    });
  }
});
