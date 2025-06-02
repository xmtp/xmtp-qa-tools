import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import manualUsers from "@helpers/manualusers.json";
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
      const receivers = manualUsers.filter((r) => r.app === "fabri-tba");
      workers = await getWorkers(
        ["bot"],
        testName,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.None,
        "dev",
      );
      try {
        const totalCount = 1000;
        for (const receiver of receivers) {
          for (let batch = 0; batch < totalCount; batch++) {
            const group = await workers
              .get("bot")
              ?.client.conversations.newGroup([receiver.inboxId]);

            if (!group) {
              throw new Error("Failed to create group");
            }

            await group.send(`Spam test message`);

            console.log(`✓ Completed ${batch + 1}/${totalCount} groups`);
          }
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    },
    timeout,
  ); // 5 minutes timeout
});
