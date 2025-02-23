import type { XmtpEnv } from "@xmtp/node-sdk";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getPersonas } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Client_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

/* 
Topics:
- Takes 3 seconds to create a client, is this expected?
*/

describe(testName, () => {
  it(
    "TC_CreateClient: Initialize the client",
    async () => {
      const [alice, randompep] = await getPersonas(
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
