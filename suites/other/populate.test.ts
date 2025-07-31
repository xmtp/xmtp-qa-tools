import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "convos";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const workers = await getWorkers(["henry"]);

  it("populate:20", async () => {
    const worker = workers.get("henry")!;
    await worker.client.conversations.sync();
    const existingConvs = await worker.client.conversations.list();
    const existingConvsCount = existingConvs.length;
    await worker.worker.populate(200);
    await worker.client.conversations.sync();
    const conversations = await worker.client.conversations.list();
    expect(conversations.length).toBe(existingConvsCount + 20);
  });
});
