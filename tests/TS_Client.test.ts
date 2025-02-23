import { afterAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import type { XmtpEnv } from "../helpers/verify";
import { defaultValues, getWorkers } from "../helpers/workers/creator";

const env: XmtpEnv = "dev";
const testName = "TS_Client_" + env;

/* 
TODO:
- Takes 3 seconds to create a client, is this expected?
*/

describe(testName, () => {
  it(
    "TC_CreateClient: Initialize the client",
    async () => {
      const logger = createLogger(testName);
      overrideConsole(logger);
      const [alice, randompep] = await getWorkers(
        ["alice", "randompep"],
        env,
        testName,
      );
      expect(alice.client?.accountAddress).toBeDefined();
      expect(randompep.client?.accountAddress).toBeDefined();
    },
    defaultValues.timeout,
  );

  afterAll(async () => {
    flushLogger(testName);
  });
});
