import { appendToEnv, getManualUsers } from "@helpers/client";
import { getTime } from "@helpers/logger";
import {
  verifyMembershipStream,
  verifyMessageStream,
  verifyMetadataStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getRandomInboxIdsWithRandomInstallations } from "@inboxes/utils";
import { typeofStream, typeOfSync } from "@workers/main";
import {
  defaultNames,
  getWorkers,
  type Worker,
  type WorkerManager,
} from "@workers/manager";
import { type Group } from "@workers/versions";
import { beforeAll, describe, it } from "vitest";

export const features = [
  "stream",
  "membership",
  "metadata",
  "epoch",
  "installations",
  "create",
];
const testConfig = {
  groupName: `Group ${getTime()}`,
  epochs: 3,
  manualUsers: getManualUsers([(process.env.XMTP_ENV as string) + "-testing"]),
  randomInboxIds: getRandomInboxIdsWithRandomInstallations(60),
  typeofStream: typeofStream.None,
  typeOfSync: typeOfSync.Both,
  workerNames: defaultNames.slice(0, 40),
  freshInstalls: false,
} as const;

const testName = "chaos";
describe(testName, () => {
  setupTestLifecycle({ testName });
  let workers: WorkerManager;
  let creator: Worker;
  let allInboxIds: string[] = [];
  let allGroups: string[] = [];

  beforeAll(async () => {
    // Initialize workers
    workers = await getWorkers(["bot", ...testConfig.workerNames]);
    // Note: typeofStream was None and typeOfResponse was None, so no streams needed
    // Start syncs if needed
    workers.getAll().forEach((worker) => {
      worker.worker.startSync(testConfig.typeOfSync);
    });
    creator = workers.get("bot") as Worker;

    // Load all existing groups
    const existingGroups =
      process.env.CREATED_GROUPS?.split(",").filter((id) => id.trim()) || [];
    console.log(`Loaded ${existingGroups.length} existing groups`);

    const group = (await creator.client.conversations.newGroup(
      testConfig.randomInboxIds,
    )) as Group;

    allGroups = [...existingGroups, group.id];
    appendToEnv("CREATED_GROUPS", allGroups.join(","));
    console.log(`Created new group: ${group.id}`);

    console.log("adding manual users");
    await group.addMembers(testConfig.manualUsers.map((u) => u.inboxId));

    console.log("adding members");
    await group.addMembers(
      workers.getAllBut("bot").map((w) => w.client.inboxId),
    );
  });

  it("verify message streams, membership changes, metadata updates, and epoch changes across all groups", async () => {
    for (const feature of features) {
      for (const groupId of allGroups) {
        console.warn(feature, groupId);
        const group = (await creator.client.conversations.getConversationById(
          groupId,
        )) as Group;
        await workers.checkForks();
        switch (feature) {
          case "create": {
            const newGroup = (await creator.client.conversations.newGroup(
              allInboxIds,
            )) as Group;
            await newGroup.sync();
            break;
          }
          case "installations":
            await verifyAddRandomInstallations(workers);
            break;
          case "stream":
            await verifyMessageStream(
              group,
              workers.getAllBut("bot"),
              1,
              `Message verification from group ${groupId}`,
            );
            break;

          case "membership":
            await verifyMembershipStream(
              group,
              workers.getAllBut("bot"),
              testConfig.randomInboxIds.slice(0, 1),
            );
            break;

          case "metadata":
            await verifyMetadataStream(
              group,
              workers.getAllBut("bot"),
              1,
              `${testConfig.groupName} #${groupId} - Updated`,
            );
            break;

          case "epoch":
            await verifyEpochChange(workers, group.id, testConfig.epochs);
            break;
        }

        console.log(`Group ${groupId} - Completed: ${feature}`);
      }
      await workers.checkForks();
      await workers.checkStatistics();
    }
  });
});
export async function verifyAddRandomInstallations(
  workers: WorkerManager,
  maxInstallationsPerWorker: number = 5,
): Promise<void> {
  for (const worker of workers.getAllBut("bot")) {
    // Random number between 1 and maxInstallationsPerWorker
    const randomInstallations =
      Math.floor(Math.random() * maxInstallationsPerWorker) + 1;

    for (let i = 0; i < randomInstallations; i++) {
      await worker.worker.addNewInstallation();
      console.log(
        `Added installation ${i + 1}/${randomInstallations} for worker ${worker.name}`,
      );
    }
  }
}
export async function verifyEpochChange(
  workers: WorkerManager,
  groupId: string,
  epochs: number,
): Promise<void> {
  for (let i = 0; i < epochs; i++) {
    const randomAdmin =
      workers.getAllBut("bot")[
        Math.floor(Math.random() * workers.getAllBut("bot").length)
      ];
    let group = (await randomAdmin.client.conversations.getConversationById(
      groupId,
    )) as Group;

    // Check if group was found before proceeding
    if (!group) {
      await randomAdmin.client.conversations.syncAll();
      group = (await randomAdmin.client.conversations.getConversationById(
        groupId,
      )) as Group;

      if (!group) {
        console.warn(
          `Group ${groupId} still not found for worker ${randomAdmin.name} after sync, skipping epoch cycle ${i}`,
        );
        continue;
      }
    }

    for (const member of getRandomInboxIdsWithRandomInstallations(6)) {
      try {
        await group.removeMembers([member]);
        await group.addMembers([member]);
        console.log(`Membership update: ${member}`);
        await group.sync();
      } catch (e) {
        console.error(`Error in membership cycle ${i}:`, e);
      }
    }
  }
}
