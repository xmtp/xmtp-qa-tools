import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { type WorkerManager } from "@helpers/types";
import { getDataSubFolderCount, getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  let folderCount: number = 0;
  beforeAll(() => {
    fs.rmSync(".data", { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("create random workers", async () => {
    workers = await getWorkers(["random"], testName, "none");
    folderCount++;
    expect(workers.get("random")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a worker", async () => {
    workers = await getWorkers(["bob", "random"], testName, "none");
    folderCount++;
    expect(workers.get("bob")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a random worker", async () => {
    workers = await getWorkers(["random"], testName, "none");

    expect(workers.get("random")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create multiple workers", async () => {
    workers = await getWorkers(
      ["bob", "alice", "randompep", "randombob"],
      testName,
      "none",
    );
    folderCount++;
    folderCount++;
    folderCount++;
    expect(workers.get("bob")?.client?.inboxId).toBeDefined();
    expect(workers.get("alice")?.client?.inboxId).toBeDefined();
    expect(workers.get("randompep")?.client?.inboxId).toBeDefined();
    expect(workers.get("randombob")?.client?.inboxId).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });
});
