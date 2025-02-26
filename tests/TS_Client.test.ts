import dotenv from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import type { Persona, XmtpEnv } from "../helpers/types";
import { getWorkers } from "../helpers/workers/factory";

dotenv.config();

const env: XmtpEnv = "dev";
const testName = "TS_Client_" + env;

/* 
TODO:
- Takes 3 seconds to create a client, is this expected?
*/

describe(testName, () => {
  let personas: Record<string, Persona>;
  beforeAll(async () => {
    const logger = await createLogger(testName);
    overrideConsole(logger);
    personas = await getWorkers(["alice", "randompep"], env, testName);
  });

  afterAll(async () => {
    await flushLogger(testName);
    await Promise.all(
      Object.values(personas).map(async (persona) => {
        await persona.worker?.terminate();
      }),
    );
  });

  it("TC_CreateClient: Initialize the client", async () => {
    expect(personas["alice"].client?.accountAddress).toBeDefined();
    expect(personas["randompep"].client?.accountAddress).toBeDefined();
  });
});
