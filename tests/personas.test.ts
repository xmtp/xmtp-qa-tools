import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { WorkerNames, type Persona } from "../helpers/types";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();

const env = "dev";
const testName = "TS_Personas_" + env;

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

  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    // Ensure the data folder is clean before running tests
    //fs.rmSync(".data", { recursive: true, force: true });
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });
  it("create random personas", async () => {
    personas = await getWorkers(["random"], env, testName);
    expect(personas.random.client?.accountAddress).toBeDefined();
  });

  it("should create a persona", async () => {
    // Get Bob's persona using the enum value.
    personas = await getWorkers(["bob", "random"], env, testName);

    expect(personas.bob.client?.accountAddress).toBeDefined();
  });

  it("should create a random persona", async () => {
    personas = await getWorkers(["random"], env, testName);
    expect(personas.random.client?.accountAddress).toBeDefined();
  });

  it("should create multiple personas", async () => {
    personas = await getWorkers(
      ["bob", "alice", "randompep", "randombob"],
      env,
      testName,
    );
    expect(personas.bob.client?.accountAddress).toBeDefined();
    expect(personas.alice.client?.accountAddress).toBeDefined();
    expect(personas.randompep.client?.accountAddress).toBeDefined();
    expect(personas.randombob.client?.accountAddress).toBeDefined();
  });
});
