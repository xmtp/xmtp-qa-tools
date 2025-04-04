import { loadEnv } from "@helpers/client";
import type { XmtpEnv } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const users: {
  [key: string]: {
    inboxId: string;
    env: string;
  };
} = {
  // cb: {
  //   inboxId: "705c87a99e87097ee2044aec0bdb4617634e015db73900453ad56a7da80157ff",
  //   env: "production",
  // },
  convos: {
    inboxId: "7b7eefbfb80e019656b6566101d6903ec8cf5494e2d6ae5ef0a4c4c886d86a47",
    env: "dev",
  },
};

const testName = "bug_fork";
loadEnv(testName);

const workerConfigs = [
  { name: "bob", id: "a", number: "100" },
  { name: "alice", id: "b", number: "104" },
  { name: "ivy", id: "c", number: "108" },
  { name: "jack", id: "d", number: "112" },
];

describe(testName, () => {
  let hasFailures = false;
  let groupId: string;

  for (const user of Object.keys(users)) {
    describe(`User: ${user} [${users[user].env}]`, () => {
      const workerInstances: { [key: string]: any } = {};
      const receiver = users[user].inboxId;

      it("should initialize first worker and create group", async () => {
        try {
          console.log(`Setting up test for ${user}[${users[user].env}]`);
          const workers = await getWorkers(
            [
              `${workerConfigs[0].name}-${workerConfigs[0].id}-${workerConfigs[0].number}`,
            ],
            testName,
            "message",
            false,
            undefined,
            users[user].env as XmtpEnv,
          );
          workerInstances[workerConfigs[0].name] = workers.get(
            workerConfigs[0].name,
            workerConfigs[0].id,
          );
          console.log("syncing all");
          await workerInstances[
            workerConfigs[0].name
          ]?.client.conversations.sync();

          // Create group with receiver
          const group = await workerInstances[
            workerConfigs[0].name
          ].client.conversations.newGroup([receiver], {
            groupName: "Test Group",
            groupDescription: "Group for fork testing",
          });
          groupId = group.id;
          console.log("Created group with ID:", groupId);
        } catch (e) {
          hasFailures = logError(e, expect);
          throw e;
        }
      });

      for (let i = 0; i < workerConfigs.length; i++) {
        const worker = workerConfigs[i];
        const isFirstWorker = i === 0;

        if (!isFirstWorker) {
          it(`should initialize ${worker.name} and send message`, async () => {
            try {
              const workers = await getWorkers(
                [`${worker.name}-${worker.id}-${worker.number}`],
                testName,
                "message",
                false,
                undefined,
                users[user].env as XmtpEnv,
              );
              workerInstances[worker.name] = workers.get(
                worker.name,
                worker.id,
              );
              console.log("syncing all");
              await workerInstances[worker.name]?.client.conversations.sync();

              const group =
                await workerInstances[
                  worker.name
                ].client.conversations.getConversationById(groupId);
              console.log(`sending message ${i + 1}/${workerConfigs.length}`);
              const message = `message ${i + 1}/${workerConfigs.length}\ngroupId: ${groupId}`;
              await group?.send(message);
            } catch (e) {
              hasFailures = logError(e, expect);
              throw e;
            }
          });
        }

        it(`should terminate and restart ${worker.name}`, async () => {
          console.warn(
            `${worker.name} terminates, deletes local data, and restarts`,
          );
          await workerInstances[worker.name]?.worker.clearDB();
          await workerInstances[worker.name]?.worker.initialize();
        });
      }
    });
  }
});
