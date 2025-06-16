import { getManualUsers, loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { setupTestLifecycle } from "@helpers/vitest";
import { getInboxIds } from "@inboxes/utils";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";
import { TEST_CONFIGS } from "../../bots/stress/index";

const config = TEST_CONFIGS.medium;
// Calculate total groups across all configurations
const totalGroups = config.reduce(
  (sum, groupConfig) => sum + groupConfig.count,
  0,
);

let HELP_TEXT = `Starting:\n`;
for (const groupConfig of config) {
  HELP_TEXT += `- ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} messages each\n`;
}
HELP_TEXT += `Total groups to create: ${totalGroups}`;
console.log(HELP_TEXT);

const receiverObj = getManualUsers(["fabri-convos-oneoff"])[0];
const receiverInboxId = receiverObj.inboxId;

const testName = "bot-stress";
loadEnv(testName);

describe("Mobile stress test", () => {
  let workers: WorkerManager;
  let bot: Worker;
  let globalGroupCounter = 0;

  setupTestLifecycle({
    expect,
  });

  beforeAll(async () => {
    try {
      workers = await getWorkers(
        ["bot"],
        testName,
        typeofStream.None,
        typeOfResponse.None,
        typeOfSync.None,
        receiverObj.network as "local" | "dev" | "production",
      );
      bot = workers.get("bot")!;
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  for (const groupConfig of config) {
    it(`Should create ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} messages`, async () => {
      try {
        console.log(
          `Creating ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} messages`,
        );

        const totalStart = performance.now();

        for (let i = 0; i < groupConfig.count; i++) {
          globalGroupCounter++;

          const groupStart = performance.now();
          const receiverInboxIds = [
            receiverInboxId,
            ...getInboxIds(groupConfig.size),
          ];

          const group =
            await bot.client.conversations.newGroup(receiverInboxIds);
          const groupTime = (performance.now() - groupStart) / 1000;

          console.log(
            `Group ${globalGroupCounter}/${totalGroups} created in ${groupTime.toFixed(2)}s`,
          );

          const messageStart = performance.now();
          const messagePromises = Array.from(
            { length: groupConfig.messages },
            (_, j) =>
              group.send(
                `Hello from group ${groupConfig.size} with ${receiverInboxIds.length} members! Message ${j + 1}`,
              ),
          );

          await Promise.all(messagePromises);
          const messageTime = (performance.now() - messageStart) / 1000;

          console.log(
            `${groupConfig.messages} messages sent in ${messageTime.toFixed(2)}s`,
          );
        }

        const totalTime = (performance.now() - totalStart) / 1000;
        console.log(
          `Total time for ${groupConfig.count} groups: ${totalTime.toFixed(2)}s`,
        );
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
