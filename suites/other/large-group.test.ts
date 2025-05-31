import { loadEnv } from "@helpers/client";
import { getInboxIds, sleep } from "@helpers/utils";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import type { Group } from "@xmtp/node-sdk";

const scriptName = "m_large_group";
loadEnv(scriptName);

// List of inbox IDs to use in the group
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

// Configuration
const GROUP_SIZE = 185;
const GROUP_ID = process.env[`200_PERSON_GROUP_ID_${process.env.XMTP_ENV}`];

/**
 * Initialize the worker and verify connection to XMTP network
 */
async function initializeWorker(): Promise<{
  worker: Worker;
  workers: WorkerManager;
}> {
  try {
    if (!GROUP_ID) {
      console.log(
        "No group ID found in environment variables, will create a new group",
      );
    }

    // Use bob worker to create and manage the group
    const workers = await getWorkers(["bob"], scriptName);
    if (!workers) {
      throw new Error("Failed to initialize workers");
    }

    const worker = workers.get("bob");
    if (!worker) {
      throw new Error("Bob worker not found");
    }

    // Ensure we can connect to the network
    await worker.client.conversations.sync();
    console.log("Successfully connected to XMTP network");

    return { worker, workers };
  } catch (error) {
    console.error("Error initializing worker:", error);
    throw error;
  }
}

/**
 * Create or verify a group with specified participants
 */
async function createOrVerifyGroup(worker: Worker): Promise<Group> {
  try {
    let group: Group | undefined;

    // If we have a group ID, try to get the existing group
    if (GROUP_ID) {
      group = (await worker.client.conversations.getConversationById(
        GROUP_ID,
      )) as Group;
    }

    // If we don't have a group yet, create a new one
    if (!group) {
      console.log(
        `Creating a new group with ${convosUsernames.length} initial participants...`,
      );
      group = (await worker.client.conversations.newGroup(convosUsernames, {
        groupName: `Large Group with ${convosUsernames.length} participants`,
        groupDescription: `Created by ${scriptName} script`,
      })) as Group;
      console.log(`New group created with ID: ${group?.id}`);
      console.log(
        `Add this to your .env file: 200_PERSON_GROUP_ID_${process.env.XMTP_ENV}=${group?.id}`,
      );
    }

    const members = await group.members();
    console.log(`Group has ${members.length} members`);

    return group;
  } catch (error) {
    console.error("Error creating or verifying group:", error);
    throw error;
  }
}

/**
 * Add members to the group up to the GROUP_SIZE
 */
async function addMembersToGroup(group: Group): Promise<void> {
  try {
    // Get the first X inboxes from the generated inboxes
    const inboxIds = getInboxIds(GROUP_SIZE);

    const allInboxIds = [...inboxIds, ...convosUsernames];
    const batchSize = 10;

    console.log(
      `Adding ${allInboxIds.length} members to group ${group.id} in batches of ${batchSize}...`,
    );

    // Add members in batches to avoid overwhelming the API
    for (let i = 0; i < allInboxIds.length; i += batchSize) {
      const batch = allInboxIds.slice(i, i + batchSize);
      try {
        await group.addMembers(batch);
        console.log(
          `Added batch ${i / batchSize + 1}/${Math.ceil(allInboxIds.length / batchSize)}`,
        );
      } catch (error) {
        console.error(`Error adding batch ${i / batchSize + 1}:`, error);
      }

      // Add a small delay between batches
      await sleep(500);
    }

    await group.sync();
    const members = await group.members();
    console.log(`Group now has ${members.length} members`);
  } catch (error) {
    console.error("Error adding members to group:", error);
    throw error;
  }
}

/**
 * Remove and re-add members to test member management functionality
 */
async function testMemberManagement(group: Group): Promise<void> {
  try {
    // Test removing and re-adding 10 members from generated inboxes
    console.log("Testing member removal and re-addition...");
    const toRemove = getInboxIds(10);

    console.log(`Removing ${toRemove.length} members...`);
    for (const member of toRemove) {
      await group.removeMembers([member]);
      console.log(`Removed member: ${member}`);
    }

    console.log(`Re-adding ${toRemove.length} members...`);
    for (const member of toRemove) {
      await group.addMembers([member]);
      console.log(`Added member: ${member}`);
    }

    console.log(`Member management test successful`);
  } catch (error) {
    console.error("Error testing member management:", error);
    throw error;
  }
}

/**
 * Remove convo usernames from the group
 */
async function removeConvoUsernames(group: Group): Promise<void> {
  try {
    console.log(`Removing ${convosUsernames.length} conversation usernames...`);

    for (const member of convosUsernames) {
      try {
        await group.removeMembers([member]);
        console.log(`Removed member: ${member}`);
      } catch (error) {
        console.error(`Error removing member ${member}:`, error);
      }
    }

    console.log(`Removal of conversation usernames complete`);
  } catch (error) {
    console.error("Error removing conversation usernames:", error);
    throw error;
  }
}

/**
 * Run all the steps in sequence
 */
async function main() {
  try {
    console.log(`Starting ${scriptName} script...`);

    // Initialize worker
    const { worker } = await initializeWorker();

    // Create or verify the group
    const group = await createOrVerifyGroup(worker);

    // Add members to the group
    await addMembersToGroup(group);

    // Test member management
    await testMemberManagement(group);

    // Remove convo usernames
    await removeConvoUsernames(group);

    console.log(`Script completed successfully!`);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error: unknown) => {
  console.error("Unhandled error in main function:", error);
  process.exit(1);
});
