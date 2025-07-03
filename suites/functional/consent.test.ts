import { verifyConsentStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "consent";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(2);

  it("should stream consent state changes when users are blocked or unblocked", async () => {
    const verifyResult = await verifyConsentStream(
      workers.getCreator(),
      workers.getReceiver(),
    );

    expect(verifyResult.allReceived).toBe(true);
  });
});
