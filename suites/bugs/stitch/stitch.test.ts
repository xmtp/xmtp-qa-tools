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
  });

  it("check stream for message", async () => {
    const result = await verifyMessageStream(dm, [receiver]);
    expect(result.allReceived).toBe(true);
  });

  it("create fresh random1 client and DM accessibility", async () => {
    // Create fresh random1 client
    const bobB = await getWorkers(["randombob-b"]);
    creator = bobB.get("randombob", "b")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log("New dm created", dm.id);
  });

  it("check stream for message", async () => {
    const result = await verifyMessageStream(dm, [receiver]);
    expect(result.allReceived).toBe(true);
  });
});
