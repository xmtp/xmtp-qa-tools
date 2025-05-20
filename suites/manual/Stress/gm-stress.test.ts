import { loadEnv } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyDmStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeOfResponse, typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Conversation } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";

const testName = "stream-stress";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const gmBotAddress = process.env.GM_BOT_ADDRESS;
  let convo: Conversation;

  setupTestLifecycle({
    expect,
  });

  it(`test ${gmBotAddress} on production`, async () => {
    try {
      workers = await getWorkers(
        ["bot"],
        testName,
        typeofStream.Message,
        typeOfResponse.None,
        "production",
      );
      console.debug(`Testing ${gmBotAddress} `);
      convo = (await workers
        .getCreator()
        ?.client.conversations.newDmWithIdentifier({
          identifier: gmBotAddress as string,
          identifierKind: IdentifierKind.Ethereum,
        })) as Conversation;
      console.log("convo.id", convo.id);
      const result = await verifyDmStream(
        convo,
        [workers.getCreator()],
        "hi",
        1,
      );

      expect(result.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });

  it("dm_stream: verify sending a message to GM bot with timing", async () => {
    try {
      // Get a reference to the GM bot conversation that was created in the first test
      expect(convo).toBeDefined();
      expect(convo.id).toBeDefined();

      // Send 5 messages to verify timing is working
      const result = await verifyDmStream(
        convo,
        [workers.getCreator()],
        "hi",
        5,
      );

      expect(result.allReceived).toBe(true);
      expect(result.averageEventTiming).toBeGreaterThan(0);
      expect(Object.keys(result.eventTimings).length).toBeGreaterThan(0);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
