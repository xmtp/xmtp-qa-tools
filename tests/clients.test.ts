import fs from "fs";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { createLogger, overrideConsole } from "../helpers/logger";
import { type Persona } from "../helpers/types";
import {
  createMultipleInstallations,
  getDataSubFolderCount,
  getWorkers,
} from "../helpers/workers/factory";

dotenv.config();

const env = "dev";
const testName = "clients" + env;

/* 
TODO:
- Inconsistent test results (~20%).
- Performance issues (>1000ms) for operations
- Old sdk to new sdk breaks (node 41 to 42)
- agent stream failures
- 20% missed streams

*/
describe(testName, () => {
  let personas: Record<string, Persona>;

  let folderCount: number = 0;
  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    fs.rmSync(".data", { recursive: true, force: true }); // TODO: remove this
  });

  it("create random personas", async () => {
    personas = await getWorkers(["random"], env, testName, "none");
    folderCount++;
    expect(personas.random.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a persona", async () => {
    // Get Bob's persona using the enum value.
    personas = await getWorkers(["bob", "random"], env, testName, "none");
    folderCount++;
    expect(personas.bob.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create a random persona", async () => {
    personas = await getWorkers(["random"], env, testName, "none");

    expect(personas.random.client?.accountAddress).toBeDefined();
    expect(getDataSubFolderCount()).toBe(folderCount);
  });

  it("should create multiple personas", async () => {
    personas = await getWorkers(
      ["bob", "alice", "randompep", "randombob"],
      env,
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
    const baseName = "fabritest";
    const suffixes = ["a", "b", "c"];
    folderCount++;

    const installations = await createMultipleInstallations(
      baseName,
      suffixes,
      env,
      testName,
    );

    // Log the installation details
    for (const [id, persona] of Object.entries(installations)) {
      console.log(
        `Name: ${persona.name}, Installation ID: ${persona.installationId}, DB Path: ${persona.dbPath}`,
      );
    }

    expect(getDataSubFolderCount()).toBe(folderCount);
  });
});
