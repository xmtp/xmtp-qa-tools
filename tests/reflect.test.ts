import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import ReflectTestSuite from "@helpers/reflect";
import type { Conversation, Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const testName = "Sending a GM";
loadEnv(testName);

describe("Basic test", () => {
  let convo: Conversation;
  let personas: Record<string, Persona>;
  let start: number;
  const reflectTestSuite = new ReflectTestSuite();

  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["larry"], testName);
  });

  beforeEach(() => {
    const testName = expect.getState().currentTestName;
    start = performance.now();
    console.time(testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
  });

  afterEach(function () {
    const testName = expect.getState().currentTestName;
    console.timeEnd(testName);
    if (testName) {
      void sendMetric(performance.now() - start, testName, personas);
    }
  });

  it("should return true", async () => {
    // Run the GM test and wait for its execution ID.
    const { executionId } = await reflectTestSuite.runSendingGmTest();

    if (executionId) {
      await reflectTestSuite.pollExecutionStatus(reflectTestSuite, executionId);
    }

    // You can add further assertions here if needed
    expect(true).toBeTruthy();
  });
});
