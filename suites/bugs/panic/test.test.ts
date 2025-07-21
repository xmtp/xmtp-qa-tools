import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

describe("bug_panic", () => {
  it("newGroupByInboxIds:measure creating a group with inbox ids", async () => {
    const workers = await getWorkers(50);
    const workerArray = workers.getAll();
    const groupByInboxIds = await workers.createGroupBetweenAll();
    for (const worker of workerArray) {
      await worker.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
