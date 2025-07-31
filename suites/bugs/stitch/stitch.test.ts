import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type Worker, type WorkerManager } from "@workers/manager";
import { type Dm } from "@workers/versions";
import { describe, expect, it } from "vitest";

const testName = "stitch";

describe(testName, () => {
  setupTestLifecycle({ testName });

  // Global variables to encapsulate shared state
  let workers: WorkerManager;
  let creator: Worker;
  let receiver: Worker;
  let dm: Dm; // The DM conversation

  it("setup", async () => {
    workers = await getWorkers(["randombob-a", "alice"]);
    creator = workers.get("randombob", "a")!;
    receiver = workers.get("alice")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultFirstDm = await verifyMessageStream(dm, [receiver]);
    expect(resultFirstDm.allReceived).toBe(true);

    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);

    const resultSecondDm = await verifyMessageStream(dm, [receiver]);
    expect(resultSecondDm.allReceived).toBe(true);
  });
});
