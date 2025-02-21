import type { XmtpEnv } from "node-sdk-42";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger, flushLogger, overrideConsole } from "../helpers/logger";
import { defaultValues, getNewRandomPersona } from "../helpers/personas";

const env: XmtpEnv = "dev";
const testName = "TS_Client_" + env;
const logger = createLogger(testName);
overrideConsole(logger);

describe(testName, () => {
  it(
    "TC_CreateClient: Initialize the client",
    async () => {
      const { address } = await getNewRandomPersona(env);
      expect(address).toBeDefined();
    },
    defaultValues.timeout,
  );

  afterAll(async () => {
    flushLogger(testName);
  });
});
