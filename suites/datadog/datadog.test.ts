import { setupTestLifecycle } from "@helpers/vitest";
import { describe, expect, it } from "vitest";
import { askClaude, processDatadogLogs, readIssuesData } from "./helper";

const testName = "datadog";

describe(testName, () => {
  setupTestLifecycle({});

  it("should fetch latest Datadog logs", async () => {
    const result = await processDatadogLogs();

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.totalLogEntries).toBeGreaterThanOrEqual(0);
    expect(result.metadata.totalTestFailures).toBeGreaterThanOrEqual(0);

    console.log(
      `📊 Fetched ${result.metadata.totalLogEntries} total log entries`,
    );
    console.log(`🚨 Found ${result.metadata.totalTestFailures} test failures`);
    console.log(
      `⏰ Query period: ${result.metadata.queryPeriod.from} to ${result.metadata.queryPeriod.to}`,
    );
  });

  it("should read processed issues data", () => {
    const issuesData = readIssuesData();

    expect(issuesData).toBeDefined();
    expect(typeof issuesData).toBe("string");

    const parsed = JSON.parse(issuesData!);
    expect(Array.isArray(parsed)).toBe(true);

    console.log(`📄 Found ${parsed.length} processed issue entries`);
  });

  it("should analyze issues with Claude", async () => {
    const issuesData = readIssuesData();

    if (!issuesData) {
      throw new Error("No issues data available");
    }

    const query =
      "What are the most critical test failures in the last 4 hours?";
    const analysis = await askClaude(query, issuesData);

    expect(analysis).toBeDefined();
    expect(typeof analysis).toBe("string");
    expect(analysis.length).toBeGreaterThan(0);

    console.log(`🤖 Claude analysis length: ${analysis.length} characters`);
    console.log(`📝 Analysis preview: ${analysis.substring(0, 200)}...`);
  });

  it("should refresh issues data periodically", async () => {
    // Force a fresh data fetch
    const beforeTime = Date.now();
    const result = await processDatadogLogs();
    const afterTime = Date.now();

    expect(result).toBeDefined();
    expect(afterTime - beforeTime).toBeLessThan(30000); // Should complete within 30 seconds

    // Verify the data was written to file
    const issuesData = readIssuesData();
    expect(issuesData).toBeDefined();

    const parsed = JSON.parse(issuesData!);
    expect(parsed.length).toBe(result.metadata.totalTestFailures);

    console.log(`🔄 Data refresh completed in ${afterTime - beforeTime}ms`);
  });
});
