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
    workers = await getWorkers(["random1", "alice"]);
    creator = workers.get("random1")!;
    receiver = workers.get("alice")!;
    dm = (await creator.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log(dm.id);
  });

  it("verify message delivery works after DM stitching", async () => {
    // Send a test message and verify delivery
    const verifyResult = await verifyMessageStream(dm, [receiver]);

    // Verify message delivery works after stitching
    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
  });

  it("create fresh random1 client and verify DM accessibility", async () => {
    // Create fresh random1 client
    const freshrandom1 = await getWorkers(["random1-fresh"]);
    const random1Fresh = freshrandom1.get("random1", "fresh")!;

    const testDm = (await random1Fresh.client.conversations.newDm(
      receiver.client.inboxId,
    )) as Dm;
    console.log(testDm.id);

    const verifyResult = await verifyMessageStream(testDm, [receiver]);

    // Verify message delivery works after stitching
    expect(verifyResult.allReceived).toBe(true);
    expect(verifyResult.receptionPercentage).toBeGreaterThan(95);
  });
});
