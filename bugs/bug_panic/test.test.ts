import { loadEnv } from "@helpers/client";
import { getRandomNames } from "@helpers/tests";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  it("createGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const workers = await getWorkers(getRandomNames(50), testName);
    const workerArray = workers.getAll();
    const groupByInboxIds = await workers.createGroup();
    for (const worker of workerArray) {
      await worker.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
