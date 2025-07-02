import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { beforeAll, describe, it } from "vitest";

describe("bug_kpke", () => {
  let workers: WorkerManager;
  let conversation: Dm;

  beforeAll(async () => {
    workers = await getWorkers(1);
  });

  setupTestLifecycle({});

  it("should send message to specific address", async () => {
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
    await verifyMessageStream(conversation, [workers.getCreator()], 1, "GANG");
    console.log("syncing all");
    await workers.getCreator().client.conversations.syncAll();
    console.log("done");
  });
});
