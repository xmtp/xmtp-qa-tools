import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "stream";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  let workers = await getWorkers(3);

  it("stream verification over time", async () => {
    // Create a group for testing
    const group = await workers.createGroupBetweenAll();
    const receivers = workers.getAllButCreator();

    // Initial verification - verify stream is working at the beginning
    console.log("Starting initial stream verification...");
    const initialResult = await verifyMessageStream(
      group,
      receivers,
      5, // Send 5 messages
      "initial-{i}-{randomSuffix}",
    );
    expect(initialResult.allReceived).toBe(true);
    console.log("Initial verification passed");

    // Wait 10 minutes and verify again
    console.log("Waiting 10 minutes before next verification...");
    await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000)); // 10 minutes

    console.log("Starting 10-minute verification...");
    const tenMinResult = await verifyMessageStream(
      group,
      receivers,
      5, // Send 5 more messages
      "tenmin-{i}-{randomSuffix}",
    );
    expect(tenMinResult.allReceived).toBe(true);
    console.log("10-minute verification passed");

    // Wait 5 more minutes (15 total) and verify again
    console.log("Waiting 5 more minutes before final verification...");
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)); // 5 minutes

    console.log("Starting 15-minute verification...");
    const fifteenMinResult = await verifyMessageStream(
      group,
      receivers,
      5, // Send 5 more messages
      "fifteenmin-{i}-{randomSuffix}",
    );
    expect(fifteenMinResult.allReceived).toBe(true);
    console.log("15-minute verification passed");

    console.log("All stream verifications completed successfully");
  });
});
