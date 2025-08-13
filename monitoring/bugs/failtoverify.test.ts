import { getInboxes, type InboxData } from "@inboxes/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Group } from "version-management/client-versions";
import { describe, it } from "vitest";

const testName = "failtoverify";
describe(testName, () => {
  const BATCH_SIZE = process.env.BATCH_SIZE
    ? process.env.BATCH_SIZE.split("-").map((v) => Number(v))
    : [5, 5];

  let newGroup: Group;
  let allMembers: InboxData[] = [];
  let cumulativeGroups: Group[] = [];

  let workers: WorkerManager;
  let creator: Worker | undefined;
  let inboxId: string;
  let randomSuffix: string;

  it(`create: measure creating a client`, async () => {
    workers = await getWorkers(1);
    creator = workers.getCreator();
  });
  for (const i of BATCH_SIZE) {
    it(`newGroup-${i}:create a large group of ${i} members ${i}`, async () => {
      allMembers = getInboxes(i);

      newGroup = (await creator!.client.conversations.newGroup(
        allMembers.map((a) => a.inboxId),
      )) as Group;
      cumulativeGroups.push(newGroup);
      randomSuffix = Math.random().toString(36).substring(2, 15);
      const singleSyncWorkers = await getWorkers(["randomC" + randomSuffix]);
      const clientSingleSync = singleSyncWorkers.get(
        "randomC" + randomSuffix,
      )!.client;
      const inboxId = clientSingleSync.inboxId;
      for (const group of cumulativeGroups) {
        console.log(
          `adding member ${inboxId} to group ${group.id} ${randomSuffix} ${
            (await group.members()).length
          }`,
        );
        await group.addMembers([clientSingleSync.inboxId]);
        console.log("member added to group ✅");
      }
    });
  }
});
