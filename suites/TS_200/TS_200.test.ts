import { closeEnv, loadEnv } from "@helpers/client";
import { sendTestResults } from "@helpers/datadog";
import generatedInboxes from "@helpers/generated-inboxes.json";
import { logError } from "@helpers/logger";
import { appendToEnv } from "@helpers/tests";
import { getWorkers, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "ts_200";
loadEnv(testName);

const convosUsernames = [
  "7ae60cc2d51957be3505b09943b7c0e314d08423f2db3d749be8325b6363a883",
  "eb82bb68d6a54bc57de35567e26bd87f5bc9993fba7c22c833980456d1cdf4bf",
  "be49f54220eed1ebc319bf889bbea5d83d3fc8b2fac949a0c9082f96120b76c5",
  "00a2d5e2c10a5360d913c8d50f45fb30fe5540d1c98283dadddaf402e6f9a9ce",
  "c8f5c76a451c59f5850fdbe19800416682af2cafc89f14d1f79ba004c079d62b",
  "f7b7bfbdda406f5d3e5f4010c43326b4cc9a59b2ed599a0c07ad28d4fcd14ba6",
  "2d0cd6a2bc7cf025f5786cce2da95229cad715bdbdbd5174d3c67abc01d969e0",
  "0c2c79134cffb08d35dadaef7195d7b42b596f828a23bea4b5235bd3819508cf",
  "12d468635f430ec39afb98010b73e4878a5f1280a663b2938c9378292e0fd867",
  "1d4ff23c4fad016f4bfec42fa81641c03e5086bf01572749f9e628eac98b64ba",
  "268008941d4d8c768e1d894ac63f954f432535a69a4b85d214e800747e75e503",
  "28eab5603e3b8935c6c4209b4beedb0d54f7abd712fc86f8dc23b2617e28c284",
  "2c23f4804e73b744989e36cdfbf175f6bfdcf021ed70183eeb5a8c5a18d6ba29",
  "3da915aa62d63c37f6270bb476b6d74420bac1209184ff7bde8c232be93e43ee",
  "50158e5b0a3dc18279f6f5d16457e907ba65ea37302b00765cb7c01df41cb25a",
  "6ae29bd02a640db30d4e1505bf510419b362e8e0f59d9110db6efb3998d092b3",
  "6b577671ab47c8cae663d757ff1238c02192591a5170060269ed7e9b28aa57f4",
  "777f5f2a02a9be7532c0d7180902bac55812aa29db0a3481e21dee221ab268f9",
  "7d2e458792cfb1faacd9f1a5887fecfa36710165e7bada7f430f6f9cb39ec6eb",
  "8e1dcd429f1083a1ecfab398d1f6553b7d3fd17fbf67cbe8ea20a35983fdde8b",
  "9925516acfdaeb3c24c9e581905bb98f5597199c4d2879e215bee94c8564e7bd",
  "bc24e97842cc921ffd5e61593290bd92349ed206f141c3f7fd09b44ac3326ad9",
  "c8c5cdf3c9b44955bc226acfd74e8302fc91d0dc221e79b30c536f298ec21af0",
  "f87420435131ea1b911ad66fbe4b626b107f81955da023d049f8aef6636b8e1b",
  "f8b1956aea068e349ed52bea4e06e0c8de41d36b1e5ac6729d08408393138145",
  "f8b1956aea068e349ed52bea4e06e0c8de41d36b1e5ac6729d08408393138145",
  "9925516acfdaeb3c24c9e581905bb98f5597199c4d2879e215bee94c8564e7bd",
  "bc24e97842cc921ffd5e61593290bd92349ed206f141c3f7fd09b44ac3326ad9",
  "c8c5cdf3c9b44955bc226acfd74e8302fc91d0dc221e79b30c536f298ec21af0",
  "f87420435131ea1b911ad66fbe4b626b107f81955da023d049f8aef6636b8e1b",
  "c8c5cdf3c9b44955bc226acfd74e8302fc91d0dc221e79b30c536f298ec21af0",
  "f87420435131ea1b911ad66fbe4b626b107f81955da023d049f8aef6636b8e1b",
  "c283c92e97ea12b4766b65b5593459f2e29076c88ad507193f298460ab649a3c",
  "977190e7bbcc22a51dfa7f663b199eee87b8e6906f1403d4606c0a199597728b",
];

describe(testName, () => {
  let workers: WorkerManager;
  let hasFailures: boolean = false;
  const GROUP_SIZE = 185;
  const ENV_VAR_NAME = `200_PERSON_GROUP_ID_${process.env.XMTP_ENV}`;

  beforeAll(async () => {
    try {
      // Use one worker to create the group
      workers = await getWorkers(["henry"], testName);
      expect(workers).toBeDefined();
      expect(workers.getWorkers().length).toBe(1);

      // Ensure we can connect to the network
      const henry = workers.get("henry")!;
      await henry.client.conversations.sync();
      console.log("Successfully connected to XMTP network");
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      sendTestResults(hasFailures, testName);
      await closeEnv(testName, workers);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it(`should create a group with ${GROUP_SIZE} participants and save the ID to .env`, async () => {
    try {
      // Check if group ID already exists in environment
      if (process.env[ENV_VAR_NAME]) {
        console.log(`Group ID already exists: ${process.env[ENV_VAR_NAME]}`);

        // Verify the group exists by trying to load it
        const existingGroupId = process.env[ENV_VAR_NAME];
        const henry = workers.get("henry")!;

        const existingGroup =
          await henry.client.conversations.getConversationById(existingGroupId);

        if (existingGroup) {
          console.log(
            `Successfully verified existing group: ${existingGroupId}`,
          );
          await existingGroup.sync();
          const members = await existingGroup.members();
          console.log(`Existing group has ${members.length} members`);

          for (const inboxId of convosUsernames) {
            try {
              await (existingGroup as Group).addMembers([inboxId]);
            } catch (e) {
              console.error(`Error adding member ${inboxId}:`, e);
            }
          }

          return;
        } else {
          console.log(
            `Existing group ID ${existingGroupId} not found, creating a new group`,
          );
        }
      }

      console.log(`Creating a new group with ${GROUP_SIZE} participants...`);
      const startTime = performance.now();

      // Get the first 200 inboxes from the generated inboxes
      const inboxIds = generatedInboxes
        .slice(0, GROUP_SIZE)
        .map((inbox) => inbox.inboxId);

      const allInboxIds = [...inboxIds];

      const henry = workers.get("henry")!;

      // Create the group with retries
      const newGroup = await henry.client.conversations.newGroup(allInboxIds, {
        groupName: `Test Group with ${allInboxIds.length} participants`,
        groupDescription: `Created by ${testName} test suite`,
      });
      for (const inboxId of convosUsernames) {
        try {
          await newGroup.addMembers([inboxId]);
        } catch (e) {
          console.error(`Error adding member ${inboxId}:`, e);
        }
      }

      expect(newGroup).toBeDefined();
      expect(newGroup.id).toBeDefined();

      const endTime = performance.now();
      console.log(`Group created with ID: ${newGroup.id}`);
      console.log(`Creation took ${(endTime - startTime) / 1000} seconds`);

      // Verify the group has the correct number of members
      await newGroup.sync();

      // Use smaller batches to get members if there are many
      const members = await newGroup.members();
      console.log(`Group has ${members.length} members`);
      appendToEnv(ENV_VAR_NAME, newGroup.id, testName);
      console.log(`Saved group ID to .env as ${ENV_VAR_NAME}=${newGroup.id}`);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });

  it("should remove and readd 10 members from the generatedInboxes", async () => {
    try {
      const henry = workers.get("henry")!;
      const groupId = process.env[ENV_VAR_NAME];
      if (!groupId) {
        throw new Error(`Group ID not found in .env: ${ENV_VAR_NAME}`);
      }
      const group =
        await henry.client.conversations.getConversationById(groupId);
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }
      const toRemove = generatedInboxes
        .slice(0, 10)
        .map((inbox) => inbox.inboxId);

      for (const member of toRemove) {
        await (group as Group).removeMembers([member]);
      }
      for (const member of toRemove) {
        await (group as Group).addMembers([member]);
      }
      console.log(`Group has ${toRemove.length} members`);
    } catch (e) {
      hasFailures = logError(e, expect);
      throw e;
    }
  });
});
