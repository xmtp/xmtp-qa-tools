// import dotenv from "dotenv";
// import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
// import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
// import { defaultValues, type Persona, type XmtpEnv } from "../helpers/types";
// import { getWorkers } from "../helpers/workers/factory";

// dotenv.config();

// /**
//  * TODO
//  * - Test multiple groups with multiple participants with multiple installations
//   - Verify group creation with different participants for incosisten stream results
// */

// const env: XmtpEnv = "dev";
// const testName = "TS_Group_installations_" + env;

// describe(testName, () => {
//   beforeAll(async () => {
//     const logger = await createLogger(testName);
//     overrideConsole(logger);
//   });

//   afterAll(async () => {
//     await flushLogger(testName);
//     // Clean up .data/random* folders after tests
//     const { execSync } = require("child_process");
//     try {
//       console.log("Cleaning up .data/random* folders");
//       execSync("rm -rf ./.data/random*");
//     } catch (error) {
//       console.error("Error cleaning up .data folders:", error);
//     }
//   });

//   const users = 2;
//   let batchSize = 2;
//   const installationsPerUser = 2;

//   it(`Measure group creation time up to ${users * installationsPerUser} participants`, async () => {
//     while (batchSize <= users * installationsPerUser) {
//       console.log(
//         `Creating group with ${batchSize} participants and ${batchSize * installationsPerUser} installations`,
//       );
//       // Use the helper function to create and time the group creation
//       await createGroupWithUsers(batchSize, installationsPerUser);

//       batchSize += 2;
//     }
//   });
// });

// /**
//  * Creates a group with a specified number of users and installations per user
//  * @param creator - The persona that will create the group
//  * @param allPersonas - Record of all available personas
//  * @param numUsers - Number of users to include in the group
//  * @param installsPerUser - Number of installations per user
//  * @returns The created group
//  */
// async function createGroupWithUsers(numUsers: number, installsPerUser: number) {
//   const fullNames = [];
//   for (let i = 1; i <= numUsers; i++) {
//     for (let j = 0; j < installsPerUser; j++) {
//       fullNames.push(
//         "random" + i.toString() + "-" + String.fromCharCode(97 + j),
//       );
//     }
//   }
//   const personas = await getWorkers(fullNames, env, testName, "none");

//   console.time(
//     `Create group with ${numUsers} users (${numUsers * installsPerUser} installations)`,
//   );

//   try {
//     // Create the group using the inbox IDs
//     // Create an empty group first
//     const creator = personas[Object.keys(personas)[0]]; // Use the first persona as creator
//     console.log(`${creator.name} is going to create the group`);
//     const group = await creator.client?.conversations.newGroupByInboxIds(
//       Object.values(personas).map(
//         (persona) => persona.client?.inboxId as string,
//       ),
//     );

//     console.log(`Group created with id ${group?.id}`);
//     if (!group) {
//       throw new Error("Failed to create group");
//     }
//     // Log group membership details
//     await group.sync();
//     const members = await group.members();
//     let totalInstallations = 0;
//     for (const member of members ?? []) {
//       console.log(
//         personas.find((p: Persona) => p.client?.inboxId === member.inboxId)
//           ?.name,
//         member.installationIds.length,
//       );
//       totalInstallations += member.installationIds.length;
//     }
//     console.log(`Total members: ${members.length}`);
//     console.log(`Total installations: ${totalInstallations}`);

//     console.timeEnd(
//       `Create group with ${numUsers} users (${numUsers * installsPerUser} installations)`,
//     );

//     return group;
//   } catch (error) {
//     console.error(`Error creating group with ${numUsers} users:`, error);
//     console.timeEnd(
//       `Create group with ${numUsers} users (${numUsers * installsPerUser} installations)`,
//     );

//     return null;
//   }
// }
