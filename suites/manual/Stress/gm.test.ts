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
      const result = await verifyDmStream(
        convo,
        [workers.getCreator()],
        "hi",
        10,
      );

      expect(result.allReceived).toBe(true);
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
