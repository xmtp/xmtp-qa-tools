import { getFixedNames } from "@helpers/client";
import { logError } from "@helpers/logger";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { typeofStream } from "@workers/main";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, expect, it } from "vitest";

const testName = "bug_kpke";

describe(testName, () => {
  let workers: WorkerManager;
  let conversation: Dm;

  beforeAll(async () => {
    workers = await getWorkers(
      getFixedNames(1),
      testName,
      typeofStream.Message,
    );
  });

  setupTestLifecycle({
    testName,
    expect,
  });

  it("should send message to specific address", async () => {
    try {
      console.log("syncing all");
      await workers.getCreator().client.conversations.syncAll();
      const targetAddress = "0x6461bf53ddb33b525c84bf60d6bb31fa10828474";
      conversation = (await workers
        .getCreator()
        .client.conversations.newDmWithIdentifier({
          identifier: targetAddress,
          identifierKind: IdentifierKind.Ethereum,
        })) as Dm;
      console.log("syncing all");
      await workers.getCreator().client.conversations.syncAll();
      await verifyMessageStream(conversation, [workers.getCreator()], 1);
      console.log("syncing all");
      await workers.getCreator().client.conversations.syncAll();
      console.log("Sending message");
      await verifyMessageStream(
        conversation,
        [workers.getCreator()],
        1,
        "GANG",
      );
      console.log("syncing all");
      await workers.getCreator().client.conversations.syncAll();
      console.log("done");
    } catch (e) {
      logError(e, expect.getState().currentTestName);
      throw e;
    }
  });
});
