import { getWorkers } from "@workers/manager";
import type { Client, Group } from "@xmtp/node-sdk";
import { loadEnv } from "dev/helpers/client";
import { setupTestLifecycle } from "dev/helpers/vitest";
import { describe, expect, it } from "vitest";

const CHAOS_GROUPS = 20;
const CHAOS_MESSAGES = 20;
const CHAOS_MEMBERS = 5;
const CHAOS_INSTALLATIONS = 5;
const TOTAL_GROUPS = CHAOS_GROUPS * CHAOS_INSTALLATIONS;
const TOTAL_MEMBERS = TOTAL_GROUPS * (CHAOS_MEMBERS + 1);
const TOTAL_MESSAGES =
  (TOTAL_MEMBERS - TOTAL_GROUPS) * CHAOS_MESSAGES + CHAOS_GROUPS;

const MAX_SLEEP = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const randomSleep = (maxSleep?: number) =>
  sleep(Math.floor(Math.random() * (maxSleep ?? MAX_SLEEP)));

const errors: {
  error: string;
  description: string;
  installationId?: string;
  groupId?: string;
}[] = [];

const testName = "installation-sync";
loadEnv(testName);

const createRegisteredTestClients = async (
  numClients: number,
): Promise<Client[]> => {
  const workerNames = Array.from(
    { length: numClients },
    (_, i) => `chaos-${i}`,
  );
  const workers = await getWorkers(workerNames, `${testName}-clients`);
  return workers.getAll().map((worker) => worker.client);
};

const createChaos = async (
  mainClient: Client,
  numTestClients: number,
  numGroups: number,
  numMessages: number,
): Promise<Group[]> => {
  const groups: Group[] = [];
  // create test clients
  const testClients = await createRegisteredTestClients(numTestClients);
  // create test groups
  await Promise.all(
    Array.from({ length: numGroups }).map(async () => {
      try {
        // create the group
        const group = await mainClient.conversations.newGroup(
          testClients.map((c) => c.inboxId),
        );
        await randomSleep();
        groups.push(group as Group);
        // sync all test clients
        await Promise.all(
          testClients.map(async (c) => {
            try {
              await c.conversations.sync();
            } catch (e: unknown) {
              errors.push({
                error: (e as Error).message,
                description: "conversations.sync() failed",
                installationId: c.installationId,
              });
            }
          }),
        );
        // get conversation on all test clients
        const testGroups = await Promise.all(
          testClients.map(async (c) => {
            try {
              return await c.conversations.getConversationById(group.id);
            } catch (e: unknown) {
              errors.push({
                error: (e as Error).message,
                description: `conversations.getConversationById() failed`,
                installationId: c.installationId,
                groupId: group.id,
              });
            }
          }),
        );
        await Promise.all(
          testGroups.map(async (testGroup, idx) => {
            // get the conversation on the test client
            if (!testGroup) {
              errors.push({
                error: `group not found`,
                description: `conversations.getConversationById() returned undefined`,
                installationId: testClients[idx].installationId,
                groupId: group.id,
              });
              return Promise.resolve();
            }
            await Promise.all(
              Array.from({ length: numMessages }).map(async () => {
                try {
                  // await randomSleep(5000);
                  await testGroup.send("gm");
                } catch (e: unknown) {
                  errors.push({
                    error: (e as Error).message,
                    description: `conversation.send() failed`,
                    installationId: testClients[idx].installationId,
                    groupId: group.id,
                  });
                }
              }),
            );
          }),
        );
      } catch (e: unknown) {
        errors.push({
          error: (e as Error).message,
          description: `conversations.newGroup() failed`,
          installationId: mainClient.installationId,
        });
      }
    }),
  );
  return groups;
};

const clientSyncAll = (client: Client, interval: number = 10000) => {
  const syncs: bigint[] = [];
  const intervalId = setInterval(() => {
    console.log(`syncing all for ${client.installationId}`);
    client.conversations
      .syncAll()
      .then((sync) => {
        syncs.push(sync);
      })
      .catch((e: unknown) => {
        errors.push({
          error: (e as Error).message,
          description: `conversations.syncAll() failed`,
          installationId: client.installationId,
        });
      });
  }, interval);
  return async () => {
    // clear the interval
    clearInterval(intervalId);
    try {
      // sync one last time
      const sync = await client.conversations.syncAll();
      // return the syncs
      return sync;
    } catch (e: unknown) {
      errors.push({
        error: (e as Error).message,
        description: `conversations.syncAll() failed`,
        installationId: client.installationId,
      });
      return syncs[syncs.length - 1] ?? BigInt(0);
    }
  };
};

const createInstallationChaos = async (
  workerName: string,
  installationId: string,
) => {
  // create the installation using worker framework
  const workers = await getWorkers(
    [`${workerName}-${installationId}`],
    `${testName}-${installationId}`,
  );
  const installation = workers.get(`${workerName}-${installationId}`)!.client;

  // start syncing the installation
  const stopSync = clientSyncAll(installation);
  // create some chaos
  const chaos = createChaos(
    installation,
    CHAOS_MEMBERS,
    CHAOS_GROUPS,
    CHAOS_MESSAGES,
  );
  // return the installation and chaos
  return { installation, chaos, stopSync };
};

const startInstallationChaos = async (
  workerName: string,
  numInstallations: number,
) => {
  const installations: Client[] = [];
  const stopSyncs: (() => Promise<bigint>)[] = [];
  const chaosResults: Promise<Group[]>[] = [];
  for (let i = 0; i < numInstallations; i++) {
    const { installation, chaos, stopSync } = await createInstallationChaos(
      workerName,
      `install-${i}`,
    );
    installations.push(installation);
    stopSyncs.push(stopSync);
    chaosResults.push(chaos);
  }
  const stopSync = async () => Promise.all(stopSyncs.map((s) => s()));
  const chaosGroups = async () => Promise.all(chaosResults);
  return { installations, stopSync, chaosGroups };
};

describe("E2E: Installation syncing", () => {
  setupTestLifecycle({ expect });

  it(
    "should sync groups and messages across multiple installations",
    {
      timeout: 300000,
    },
    async () => {
      const baseWorkerName = "chaos-main";
      const { installations, stopSync, chaosGroups } =
        await startInstallationChaos(baseWorkerName, CHAOS_INSTALLATIONS);

      // wait for the chaos to end, get the created groups
      const groups = await chaosGroups();
      expect(groups.flat().length).toBe(TOTAL_GROUPS);

      const flatGroups = groups.flat();
      const maybeForked = await Promise.all(
        flatGroups.map(async (g) => {
          const debugInfo = await g.debugInfo();
          if (debugInfo.maybeForked) {
            return true;
          }
          return false;
        }),
      );
      console.log(
        `number of maybe groups: ${maybeForked.filter(Boolean).length}`,
      );

      // stop the installation syncs, get the number of synced items
      const syncs = await stopSync();

      console.log("================ ERROR REPORT ==================");
      console.log(JSON.stringify(errors, null, 2));
      console.log("================================================");

      // do some logging before the assertions
      console.log("================= SYNC REPORT ==================");
      syncs.forEach((sync, idx) => {
        console.log(
          `total syncs for installation ${installations[idx].installationId}: ${sync}`,
        );
      });
      console.log("=================================================");

      console.log("============= INSTALLATION REPORT ===============");
      await Promise.all(
        installations.map(async (installation) => {
          const groups = await installation.conversations.list();
          const members = await Promise.all(groups.map((g) => g.members()));
          const messages = await Promise.all(groups.map((g) => g.messages()));
          console.log(
            `installation ${installation.installationId} groups: ${groups.length}, members: ${members.flat().length}, messages: ${messages.flat().length}`,
          );
          console.log(installation.apiStatistics());
        }),
      );
      console.log("=================================================");
      await Promise.all(
        installations.map(async (installation) => {
          const groups = await installation.conversations.list();
          expect(groups.length).toBe(TOTAL_GROUPS);

          const members = await Promise.all(groups.map((g) => g.members()));
          expect(members.flat().length).toBe(TOTAL_MEMBERS);

          const messages = await Promise.all(groups.map((g) => g.messages()));
          expect(messages.flat().length).toBe(TOTAL_MESSAGES);
        }),
      );
    },
  );
});
