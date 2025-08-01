import {
  verifyAgentMessageStream,
  verifyMessageStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { IdentifierKind, type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "stitch";

describe(testName, () => {
  setupTestLifecycle({ testName });

  // Global variables to encapsulate shared state
  let workers: WorkerManager;
  let creator: Worker;

  it("setup with external agent", async () => {
    workers = await getWorkers(["randombob-a"], {
      env: "production",
    });
    creator = workers.get("randombob", "a")!;
    const conversation = await creator.client.conversations.newDmWithIdentifier(
      {
        identifier: "0xadc58094c42e2a8149d90f626a1d6cfb4a79f002",
        identifierKind: IdentifierKind.Ethereum,
      },
    );

    const result = await verifyAgentMessageStream(
      conversation,
      [workers.getCreator()],
      "Hello, world!",
      3,
    );

    expect(result?.allReceived).toBe(true);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"], {
      env: "production",
    });
    creator = bobB.get("randombob", "b")!;
    const conversation2 =
      await creator.client.conversations.newDmWithIdentifier({
        identifier: "0xadc58094c42e2a8149d90f626a1d6cfb4a79f002",
        identifierKind: IdentifierKind.Ethereum,
      });

    const resultSecondDm = await verifyAgentMessageStream(
      conversation2,
      [workers.getCreator()],
      "Hello, world!",
      3,
    );
    expect(resultSecondDm?.allReceived).toBe(true);
  });

  // it("setup", async () => {
  //   workers = await getWorkers(["randombob-a", "alice"]);
  //   creator = workers.get("randombob", "a")!;
  //   receiver = workers.get("alice")!;
  //   dm = (await creator.client.conversations.newDm(
  //     receiver.client.inboxId,
  //   )) as Dm;
  //   console.log("New dm created", dm.id);

  //   const resultFirstDm = await verifyMessageStream(dm, [receiver]);
  //   expect(resultFirstDm.allReceived).toBe(true);

  //   // Create fresh random1 client
  //   const bobB = await getWorkers(["randombob-b"]);
  //   creator = bobB.get("randombob", "b")!;
  //   dm = (await creator.client.conversations.newDm(
  //     receiver.client.inboxId,
  //   )) as Dm;
  //   console.log("New dm created", dm.id);

  //   const resultSecondDm = await verifyMessageStream(dm, [receiver]);
  //   expect(resultSecondDm.allReceived).toBe(false);
  // });
});
