import "@helpers/datadog";
import { checkKeyPackageStatusesByInboxId } from "@helpers/client";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Group } from "versions/sdk-node-versions";
import { describe, expect, it } from "vitest";

const testName = "performance";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5];

  let newGroup: Group;

  let extraMember: string;
  let allMembers: InboxData[] = [];
  let allMembersWithExtra: InboxData[] = [];
  let cumulativeGroups: Group[] = [];

  let workers: WorkerManager;
  let creator: Worker | undefined;
  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(5);
    creator = workers.getCreator();
  });
  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxes(i - workers.getAll().length + 2, 2, i);
      allMembers = allMembersWithExtra.slice(0, allMembersWithExtra.length - 2);
      extraMember =
        "b164a6401398ac50ad9c80f1530201d4dbd2b0771ea26d697c0e43a358b79f59";
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
    it(`addMember-${i}:add members to a group`, async () => {
      await checkKeyPackageStatusesByInboxId(creator!.client, extraMember);
      await newGroup.addMembers([extraMember]);
    });
  }
});
