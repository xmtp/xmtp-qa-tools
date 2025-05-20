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

const messageCount = 10;
describe(testName, () => {
  setupTestLifecycle({
    expect,
  });

  it("should send messages to GM bot and verify responses", async () => {
    try {
      const gmBot = await getWorkers(
        ["gm"],
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
      );
      const gmBotAddress = gmBot.get("gm")?.address;
      if (!gmBotAddress) {
        throw new Error("GM bot address not found");
      }
      // Create workers with fixed names for simplicity
      const workers = await getWorkers(
        getRandomNames(2),
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
      );

      // Create conversations and send messages for each worker in parallel
      const results = await Promise.all(
        workers.getAll().map(async (worker) => {
          // Create a DM conversation with the GM bot
          const conversation =
            await worker.client.conversations.newDmWithIdentifier({
              identifier: gmBotAddress,
              identifierKind: IdentifierKind.Ethereum,
            });

          console.log(
            `Created conversation for ${worker.name} with the GM bot`,
          );

          // Verify that the worker received responses from the GM bot
          const verifyResult = await verifyDmStream(
            conversation,
            [worker],
            "gm",
            messageCount,
          );
          console.log(worker.name, verifyResult.stats?.receptionPercentage);
          return {
            name: worker.name,
            percentage: verifyResult.stats?.receptionPercentage,
          };
        }),
      );
      expect(
        results.every((percentage) => percentage.percentage ?? 0 > 0),
      ).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
