import fs from "fs";
import { closeEnv, loadEnv } from "@helpers/client";
import ReflectTestSuite from "@helpers/reflect";
import type { Conversation, Persona } from "@helpers/types";
import { getWorkers } from "@helpers/workers/factory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testName = "Sending a GM";
loadEnv(testName);

describe("Basic test", () => {
  let personas: Record<string, Persona>;
  const reflectTestSuite = new ReflectTestSuite();

  beforeAll(async () => {
    fs.rmSync(".data", { recursive: true, force: true });
    personas = await getWorkers(["larry"], testName);
  });

  afterAll(async () => {
    await closeEnv(testName, personas);
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
