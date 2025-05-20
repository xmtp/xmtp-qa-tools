import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyDmStream } from "@helpers/streams";
import { getRandomNames } from "@helpers/tests";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "stream-stress";
loadEnv(testName);

const messageCount = 100;
describe(testName, () => {
  const gmBotAddress = process.env.GM_BOT_ADDRESS || "";

  setupTestLifecycle({
    expect,
  });

  it("should send messages to GM bot and verify responses", async () => {
    try {
      const gmWorker = await getWorkers(
        ["gm"],
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
      );
      const gmBot = gmWorker.getCreator();
      // Create workers with fixed names for simplicity
      const workers = await getWorkers(
        getRandomNames(10),
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
      );

      // Create conversations and send messages for each worker in parallel
      await Promise.all(
        workers.getAll().map(async (worker) => {
          // Create a DM conversation with the GM bot
          const conversation =
            await worker.client.conversations.newDmWithIdentifier({
              identifier: gmBot.address,
              identifierKind: IdentifierKind.Ethereum,
            });

          console.log(
            `Created conversation for ${worker.name} with the GM bot`,
          );

          for (let i = 0; i < messageCount; i++) {
            const message = `gm-${worker.name}-${i}`;
            await conversation.send(message);
          }

          // Verify that the worker received responses from the GM bot
          const verifyResult = await verifyDmStream(
            conversation,
            [worker],
            "hi", // Content doesn't matter as we're just checking responses
            messageCount,
          );
          console.log(verifyResult.stats?.receptionPercentage);
          expect(verifyResult.stats?.receptionPercentage).toBeGreaterThan(0);
        }),
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
