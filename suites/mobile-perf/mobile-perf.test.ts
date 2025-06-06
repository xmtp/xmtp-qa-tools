import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { getInboxIds, getManualUsers } from "@helpers/utils";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream, typeOfSync } from "@workers/main";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { beforeAll, describe, expect, it } from "vitest";
import { TEST_CONFIGS } from "../../bots/stress/index";

const config = TEST_CONFIGS.medium;
let HELP_TEXT = `Starting:\n`;
for (const groupConfig of config) {
  HELP_TEXT += `- Send ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} DMs from each of ${groupConfig.size} workers to you\n`;
}
console.warn(HELP_TEXT);

const receiverObj = getManualUsers(["fabri-convos-dev"])[0];
const receiverInboxId = receiverObj.inboxId;

const testName = "bot-stress";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  let bot: Worker;

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
    it(`populateGroups: should create ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} DMs`, async () => {
      try {
        console.debug(
          `Creating ${groupConfig.count} groups of ${groupConfig.size} members with ${groupConfig.messages} DMs`,
        );
        for (let i = 0; i < groupConfig.count; i++) {
          const receiverInboxIds = [
            receiverInboxId,
            ...getInboxIds(groupConfig.size),
          ];
          console.debug(
            `Creating group of ${receiverInboxIds.length} members with ${groupConfig.messages} DMs`,
          );
          const group =
            await bot.client.conversations.newGroup(receiverInboxIds);
          for (let j = 0; j < groupConfig.messages; j++) {
            console.debug(`Sending DM ${j + 1} of ${groupConfig.messages}`);
            await group.send(
              `Hello from group ${groupConfig.size} with ${receiverInboxIds.length} members!`,
            );
          }
        }
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
