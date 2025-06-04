import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getManualUsers } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "spam";
loadEnv(testName);

const timeout = 300000000;
describe(testName, () => {
  let workers: WorkerManager;

  setupTestLifecycle({
    expect,
  });

  it(
    `should create groups and send messages to dev-testing`,
    async () => {
      try {
        const receiver = getManualUsers(["fabri-tba"]);
        console.log(JSON.stringify(receiver, null, 2));
        workers = await getWorkers(
          ["bot"],
          testName,
          typeofStream.None,
          typeOfResponse.None,
          typeOfSync.None,
          receiver[0].network as "production" | "dev" | "local",
        );
        const totalCount = 1000;
        for (let batch = 0; batch < totalCount; batch++) {
          const group = await workers
            .get("bot")
            ?.client.conversations.newGroup([receiver[0].inboxId], {
              groupName: `Spam test group ${batch}`,
            });

          if (!group) {
            throw new Error("Failed to create group");
          }

          await group.send(`Spam test message`);

          console.log(`✓ Completed ${batch + 1}/${totalCount} groups`);
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    },
    timeout,
  ); // 5 minutes timeout
});
