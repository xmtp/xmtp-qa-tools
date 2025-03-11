import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { type NestedPersonas } from "@helpers/types";
import { getDataSubFolderCount, getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  let personas: NestedPersonas;

  let folderCount: number = 0;
  beforeAll(() => {
    fs.rmSync(".data", { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  it("create random personas", async () => {
    personas = await getWorkers(["random"], testName, "none");
    folderCount++;
    expect(personas.get("random")?.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a persona", async () => {
    personas = await getWorkers(["bob", "random"], testName, "none");
    folderCount++;
    expect(personas.get("bob")?.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a random persona", async () => {
    personas = await getWorkers(["random"], testName, "none");

    expect(personas.get("random")?.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create multiple personas", async () => {
    personas = await getWorkers(
      ["bob", "alice", "randompep", "randombob"],
      testName,
      "none",
    );
    folderCount++;
    folderCount++;
    folderCount++;
    expect(personas.get("bob")?.client?.accountAddress).toBeDefined();
    expect(personas.get("alice")?.client?.accountAddress).toBeDefined();
    expect(personas.get("randompep")?.client?.accountAddress).toBeDefined();
    expect(personas.get("randombob")?.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });
});
