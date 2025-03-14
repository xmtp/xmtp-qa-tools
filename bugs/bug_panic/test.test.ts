import { loadEnv } from "@helpers/client";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const workers = await getWorkers(50, testName);
    const workerArray = workers.getWorkers();
    const groupByInboxIds = await workers
      .get("bob")!
      .client.conversations.newGroup(
        workers.getWorkers().map((worker) => worker.client.inboxId),
      );
    for (const worker of workerArray) {
      await worker.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
