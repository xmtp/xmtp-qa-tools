import { getWorkers } from "@workers/manager";
import { loadEnv } from "dev/helpers/client";
import { getFixedNames } from "dev/helpers/utils";
import { describe, expect, it } from "vitest";

const testName = "bug_panic";
loadEnv(testName);

describe(testName, () => {
  it("newGroupByInboxIds: should measure creating a group with inbox ids", async () => {
    const workers = await getWorkers(getFixedNames(50), testName);
    const workerArray = workers.getAll();
    const groupByInboxIds = await workers.createGroup();
    for (const worker of workerArray) {
      await worker.worker?.terminate();
    }
    expect(groupByInboxIds.id).toBeDefined();
  });
});
