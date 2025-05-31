import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "spam";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const receiver =
    "938ce0ff99ac3d0cbc68ac50db3376dc37b29b8062b223759f19b9d635b5434a";

  setupTestLifecycle({
    expect,
  });

  it(`should create groups and send messages to ${receiver}`, async () => {
    try {
      workers = await getWorkers(
        ["bot"],
        testName,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.None,
        "dev",
      );

      const totalCount = 1000;

      for (let batch = 0; batch < totalCount; batch++) {
        const group = await workers
          .get("bot")
          ?.client.conversations.newGroup([receiver]);

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
  }, 300000000); // 5 minutes timeout
});
