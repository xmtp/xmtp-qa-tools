import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { describe, expect } from "vitest";

const testName = "progress";
describe(testName, async () => {
  setupTestLifecycle({
    testName,
  });
  let workers = await getWorkers(10, {
    randomNames: false,
  });
  const amount = 500;
  const worker = workers.get("henry")!;
  await worker.client.conversations.sync();
  const existingConvs = await worker.client.conversations.list();
  const existingConvsCount = existingConvs.length;
  await worker.worker.populate(amount);
  await worker.client.conversations.sync();
  const conversations = await worker.client.conversations.list();
  expect(conversations.length).toBe(existingConvsCount + amount);
});
