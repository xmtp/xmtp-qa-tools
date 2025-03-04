import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { type Persona } from "@helpers/types";
import {
  createMultipleInstallations,
  getDataSubFolderCount,
  getWorkers,
} from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "clients";
loadEnv(testName);

describe(testName, () => {
  let personas: Record<string, Persona>;

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
    expect(personas.random.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a persona", async () => {
    personas = await getWorkers(["bob", "random"], testName, "none");
    folderCount++;
    expect(personas.bob.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a random persona", async () => {
    personas = await getWorkers(["random"], testName, "none");

    expect(personas.random.client?.accountAddress).toBeDefined();
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
    expect(personas.bob.client?.accountAddress).toBeDefined();
    expect(personas.alice.client?.accountAddress).toBeDefined();
    expect(personas.randompep.client?.accountAddress).toBeDefined();
    expect(personas.randombob.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create multiple installations for the same persona", async () => {
    // Create a base persona and multiple installations

    personas = await getWorkers(["fabri"], testName, "none");

    const suffixes = ["a", "b", "c"];
    folderCount++;

    const installations = await createMultipleInstallations(
      personas.fabritest,
      suffixes,
      testName,
    );

    // Log the installation details
    for (const [_id, persona] of Object.entries(installations)) {
      console.log(
        `Name: ${persona.name}, Installation ID: ${persona.installationId}, DB Path: ${persona.dbPath}`,
      );
    }

    expect(getDataSubFolderCount()).toBe(folderCount);
  });
});
