import { setupTestLifecycle } from "@helpers/vitest";
import { describe, expect, it } from "vitest";
import { askClaude, processDatadogLogs, readIssuesData } from "./helper";

const testName = "datadog-latest";

describe(testName, () => {
  setupTestLifecycle({ testName });

  it("should fetch latest Datadog logs from the last hour", async () => {
    // Get data from the last hour only
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await processDatadogLogs({
      timeRange: {
        from: oneHourAgo.toISOString(),
        to: now.toISOString(),
      },
    });

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.totalLogEntries).toBeGreaterThanOrEqual(0);
    expect(result.metadata.totalTestFailures).toBeGreaterThanOrEqual(0);

    // Verify the time range is correct (last hour)
    const queryFrom = new Date(result.metadata.queryPeriod.from);
    const queryTo = new Date(result.metadata.queryPeriod.to);
    const timeDiff = queryTo.getTime() - queryFrom.getTime();
    const oneHourMs = 60 * 60 * 1000;

    expect(timeDiff).toBeLessThanOrEqual(oneHourMs + 5000); // Allow 5s buffer
    expect(timeDiff).toBeGreaterThan(oneHourMs - 5000); // Allow 5s buffer

    console.log(
      `📊 Latest data: ${result.metadata.totalLogEntries} log entries from last hour`,
    );
    console.log(
      `🚨 Recent failures: ${result.metadata.totalTestFailures} test failures`,
    );
    console.log(
      `⏰ Time range: ${result.metadata.queryPeriod.from} to ${result.metadata.queryPeriod.to}`,
    );
  });

  it("should fetch latest critical issues from the last 30 minutes", async () => {
    // Get data from the last 30 minutes for real-time monitoring
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const result = await processDatadogLogs({
      timeRange: {
        from: thirtyMinutesAgo.toISOString(),
        to: now.toISOString(),
      },
    });

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();

    // Verify this is recent data
    const queryTo = new Date(result.metadata.queryPeriod.to);
    const nowTime = new Date();
    const recentnessMs = nowTime.getTime() - queryTo.getTime();

    // Should be within last 5 minutes
    expect(recentnessMs).toBeLessThan(5 * 60 * 1000);

    console.log(
      `🔥 Critical monitoring: ${result.metadata.totalTestFailures} failures in last 30 minutes`,
    );
    console.log(`📈 Data freshness: ${Math.round(recentnessMs / 1000)}s ago`);

    // If there are recent failures, log them for immediate attention
    if (result.metadata.totalTestFailures > 0) {
      console.log(`⚠️  ALERT: Recent test failures detected in production!`);
    }
  });

  it("should analyze latest failures with real-time context", async () => {
    // First fetch the latest data
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await processDatadogLogs({
      timeRange: {
        from: twoHoursAgo.toISOString(),
        to: now.toISOString(),
      },
    });

    const issuesData = readIssuesData();

    if (!issuesData) {
      console.log("ℹ️  No recent issues data available for analysis");
      return;
    }

    const parsed = JSON.parse(issuesData);

    if (parsed.length === 0) {
      console.log("✅ No recent test failures found in the last 2 hours");
      return;
    }

    const query = `What are the most recent and critical test failures happening right now? Focus on:
      1. Any failures from the last 30 minutes (highest priority)
      2. Patterns that suggest ongoing system issues
      3. Any new failure types that weren't seen before
      Be very concise and focus on actionable insights for immediate response.`;

    const analysis = await askClaude(query, issuesData);

    expect(analysis).toBeDefined();
    expect(typeof analysis).toBe("string");
    expect(analysis.length).toBeGreaterThan(0);

    console.log(`🤖 Real-time analysis of ${parsed.length} recent failures:`);
    console.log(`📋 ${analysis}`);

    // Check if this is urgent (multiple recent failures)
    if (parsed.length > 5) {
      console.log(
        `🚨 HIGH ALERT: ${parsed.length} failures detected - immediate attention needed!`,
      );
    }
  });

  it("should validate data freshness and availability", async () => {
    // Test with a very recent time window to ensure data pipeline is working
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const result = await processDatadogLogs({
      timeRange: {
        from: fiveMinutesAgo.toISOString(),
        to: now.toISOString(),
      },
    });

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.allLogs).toBeDefined();

    // Verify API connectivity and data freshness
    const processingTime = new Date(result.metadata.date);
    const now2 = new Date();
    const processingDelay = now2.getTime() - processingTime.getTime();

    expect(processingDelay).toBeLessThan(30000); // Processing should be under 30 seconds

    console.log(`✅ Data pipeline health check: OK`);
    console.log(`🔄 Processing delay: ${Math.round(processingDelay / 1000)}s`);
    console.log(
      `📊 Latest 5min window: ${result.metadata.totalLogEntries} logs, ${result.metadata.totalTestFailures} failures`,
    );

    // Log the data pipeline status
    if (result.metadata.totalLogEntries === 0) {
      console.log(
        `ℹ️  No logs in the last 5 minutes - system may be quiet or experiencing issues`,
      );
    } else {
      console.log(`📈 Active logging detected - data pipeline is healthy`);
    }
  });
});
