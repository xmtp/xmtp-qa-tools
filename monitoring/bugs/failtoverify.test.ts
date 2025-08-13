import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Group } from "version-management/client-versions";
import { describe, expect, it } from "vitest";

const testName = "failtoverify";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [2, 2];

  let newGroup: Group;

  let allMembers: InboxData[] = [];
  let allMembersWithExtra: InboxData[] = [];
  let cumulativeGroups: Group[] = [];

  setupDurationTracking({
    testName,
  });

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let inboxId: string;

  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(1);
    creator = workers.getCreator();
    inboxId =
      "5e87c17737d0ff909930ea4962253afb0379b8c1b491b9d3215f739d0daf4040";
  });
  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembersWithExtra = getInboxes(i - workers.getAll().length + 2);
      allMembers = allMembersWithExtra.slice(0, allMembersWithExtra.length - 2);
      console.log("allMembers", allMembers.length);
      const membersToAdd = [...allMembers.map((a) => a.inboxId)];
      newGroup = (await creator!.client.conversations.newGroup(
        membersToAdd,
      )) as Group;

      cumulativeGroups.push(newGroup);
      for (const group of cumulativeGroups) {
        console.log(
          "adding member to group",
          group.id,
          (await group.members()).length,
        );
        await group.addMembers([inboxId]);
        console.log("member added to group ✅");
      }
    });
  }
});
