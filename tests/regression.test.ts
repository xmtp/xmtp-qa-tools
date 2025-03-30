import { closeEnv, loadEnv } from "@helpers/client";
import { getWorkers, type WorkerManager } from "@workers/manager";
import { afterAll, describe, expect, it } from "vitest";

const testName = "regression";
loadEnv(testName);

describe(testName, () => {
  let workers: WorkerManager;
  const cbUser = process.env.CB_USER;
  const convosUser = process.env.CONVOS_USER;
  if (!cbUser || !convosUser) {
    throw new Error("CB_USER or CONVOS_USER is not set");
  }
  afterAll(async () => {
    await closeEnv(testName, workers);
  });

  it("should create duplicate conversations when web client restarts", async () => {
    workers = await getWorkers(["ivy-100-100", "ivy-104-104"], testName);
    const ivy100 = workers.get("ivy", "100");
    const ivy104 = workers.get("ivy", "104");
    console.log("ivy100", ivy100?.version, "ivy104", ivy104?.version);
    expect(ivy100?.version).not.toBe(ivy104?.version);
  });
});
