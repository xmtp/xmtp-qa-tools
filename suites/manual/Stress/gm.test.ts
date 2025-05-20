import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyDmStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers } from "@workers/manager";
import { IdentifierKind } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "stream-stress";
loadEnv(testName);

const messageCount = 10;
describe(testName, () => {
  const gmBotAddress = process.env.GM_BOT_ADDRESS || "";

  setupTestLifecycle({
    expect,
  });

  it("should send messages to GM bot and verify responses", async () => {
    try {
      // Create workers with fixed names for simplicity
      const workers = await getWorkers(
        ["alice"],
        testName,
        typeofStream.Message,
        typeOfResponse.Gm,
        "production",
      );

      // Create conversations and send messages for each worker in parallel
      await Promise.all(
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

          console.log(
            `${worker.name}: Received ${verifyResult.messageReceivedCount || 0} responses, success: ${verifyResult.allReceived}`,
          );
        }),
      );
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
