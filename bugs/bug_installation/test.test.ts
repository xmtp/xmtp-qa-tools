import { closeEnv, loadEnv } from "@helpers/client";
import type { WorkerManager } from "@helpers/types";
import { getWorkers } from "@workers/manager";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "bug_installation";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;

  beforeAll(async () => {
    workers = await getWorkers(["bob", "alice", "joe"], testName, "none");
  });

  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("inboxState", async () => {
    for (const worker of workers.getWorkers()) {
      const inboxState = await worker.client.inboxState();
      console.log("Installations", inboxState.installations.length);
    }
  });

  it("should create a group with bob and alice", async () => {
    const group = await workers
      .get("bob")!
      .client.conversations.newGroup([workers.get("alice")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });

  it("should create a group with bob and alice", async () => {
    const group = await workers
      .get("bob")!
      .client.conversations.newGroup([workers.get("joe")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });
  it("joe with alice", async () => {
    const group = await workers
      .get("joe")!
      .client.conversations.newGroup([workers.get("alice")!.client.inboxId]);
    expect(group.id).toBeDefined();
  });
  // it("fabri creates a grop with all", async () => {
  //   const group = await workers[
  //     "fabri"
  //   ].client.conversations.newGroup([
  //     workers["bob"].client.inboxId,
  //     workers["alice"].client.inboxId,
  //     workers["joe"].client.inboxId,
  //   ]);
  //   expect(group.id).toBeDefined();
  // });
});
