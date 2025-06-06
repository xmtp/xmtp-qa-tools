import { loadEnv } from "@helpers/client";
import { getTime, logError } from "@helpers/logger";
import {
  getFixedNames,
  getManualUsers,
  getRandomInboxIds,
} from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const TEST_NAME = "group";
const testConfig = {
  testName: TEST_NAME,
  groupName: `Group ${getTime()}`,
  epochs: 3,
  manualUsers: getManualUsers(["fabri-tba"]),
  network: "production",
  preInstallations: 20,
  randomInboxIds: 60,
  typeofStream: typeofStream.None,
  typeOfResponse: typeOfResponse.None,
  typeOfSync: typeOfSync.Both,
  workerNames: getFixedNames(40),
  freshInstalls: false,
} as const;

const numberOfWorkers = 10;
const groupsPerIteration = 5; // Variable X
const iterations = 3;

loadEnv(TEST_NAME);

describe(TEST_NAME, () => {
  setupTestLifecycle({ expect });

  it("should create multiple groups with new installations per iteration", async () => {
    try {
      for (let iteration = 1; iteration <= iterations; iteration++) {
        console.log(`\n🔄 Starting iteration ${iteration}/${iterations}...`);

        // Create new workers (new installations) for this iteration
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const workerNames = Array.from(
          { length: numberOfWorkers },
          (_, i) => `worker${i}-${randomSuffix}-iter${iteration}`,
        );

        console.log(
          `Creating ${numberOfWorkers} workers with new installations...`,
        );
        const workers = await getWorkers(
          workerNames,
          TEST_NAME,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
        );

        // Create X groups in this iteration
        for (
          let groupIndex = 1;
          groupIndex <= groupsPerIteration;
          groupIndex++
        ) {
          console.log(
            `  Creating group ${groupIndex}/${groupsPerIteration} in iteration ${iteration}...`,
          );

          // Use first worker as group creator, add some other workers as members
          const creator = workers.get(workerNames[0]);
          const memberWorkers = workerNames.slice(1, 4); // Add 3 members to each group
          const memberInboxIds = memberWorkers
            .map((name) => workers.get(name)?.inboxId)
            .filter(Boolean) as string[];

          if (!creator) {
            throw new Error(`Creator worker not found: ${workerNames[0]}`);
          }

          const group = await creator.client.conversations.newGroup(
            memberInboxIds,
            {
              groupName: `Group ${groupIndex} - Iteration ${iteration}`,
              groupDescription: `Test group created in iteration ${iteration}`,
            },
          );

          expect(group).toBeDefined();
          expect(group.id).toBeDefined();

          // Send a test message
          await group.send(
            `Hello from iteration ${iteration}, group ${groupIndex}!`,
          );

          console.log(
            `    ✅ Group ${groupIndex} created with ID: ${group.id}`,
          );
        }

        await workers.checkForks();
        console.log(
          `✅ Iteration ${iteration} completed: ${groupsPerIteration} groups created`,
        );
      }

      console.log(
        `\n🎉 Test completed: ${iterations} iterations × ${groupsPerIteration} groups = ${iterations * groupsPerIteration} total groups created`,
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName || "unknown test");
      throw e;
    }
  });
});
