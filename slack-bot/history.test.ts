import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { processDatadogLogs } from "./helper";

dotenv.config();

describe("Datadog Logs Integration Test", () => {
  beforeAll(() => {
    if (!process.env.DATADOG_API_KEY) {
      throw new Error("DATADOG_API_KEY environment variable is required");
    }
    if (!process.env.DATADOG_APP_KEY) {
      throw new Error("DATADOG_APP_KEY environment variable is required");
    }
  });

  it("should fetch and process today's test failures from Datadog", async () => {
    const result = await processDatadogLogs();

    // Verify file was created
    const filepath = path.join(__dirname, "issues.json");
    expect(fs.existsSync(filepath)).toBe(true);

    // Verify results
    expect(result.testFailures.length).toBeGreaterThanOrEqual(0);
    expect(result.allLogs.length).toBeGreaterThanOrEqual(0);

    console.log(
      `✅ Extracted ${result.testFailures.length} test failures from Datadog logs`,
    );
    console.log(`📊 Processed ${result.allLogs.length} total log entries`);
  }, 30000);
});
