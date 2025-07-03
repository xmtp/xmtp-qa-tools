import { verifyConsentStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "consent";
describe(testName, async () => {
  let workers: WorkerManager;

  workers = await getWorkers(2);

  setupTestLifecycle({ testName });

  it("should stream consent state changes when users are blocked or unblocked", async () => {
    const verifyResult = await verifyConsentStream(
      workers.getCreator(),
      workers.getReceiver(),
    );

    expect(verifyResult.allReceived).toBe(true);
  });
});
