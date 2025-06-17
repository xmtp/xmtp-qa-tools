import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { beforeAll, describe, expect, it } from "vitest";

dotenv.config();

export interface DatadogLogEntry {
  id: string;
  type: string;
  attributes: {
    service: string;
    message: string;
    timestamp?: string;
    attributes: {
      test?: string;
      region?: string;
      env?: string;
      libxmtp?: string;
      service?: string;
      level?: string;
      [key: string]: any;
    };
  };
}

interface DatadogLogsResponse {
  data: DatadogLogEntry[];
  meta: {
    page: {
      after?: string;
    };
  };
}

interface TestFailure {
  testName: string | null;
  environment: string | null;
  geolocation: string | null;
  timestamp: string | null;
  workflowUrl: string | null;
  dashboardUrl: string | null;
  customLinks: string | null;
  errorLogs: string[];
}

describe("Datadog Logs Integration Test", () => {
  beforeAll(() => {
    if (!process.env.DATADOG_API_KEY) {
      throw new Error("DATADOG_API_KEY environment variable is required");
    }
    if (!process.env.DATADOG_APP_KEY) {
      throw new Error("DATADOG_APP_KEY environment variable is required");
    }
  });

  it("should fetch today's test failures from Datadog", async () => {
    // Calculate time range for today
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const fromTime = startOfToday.toISOString();
    const toTime = now.toISOString();

    // Query Datadog Logs API
    const allLogs: DatadogLogEntry[] = [];
    let nextCursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        "filter[query]": "service:xmtp-qa-tools",
        "filter[from]": fromTime,
        "filter[to]": toTime,
        "page[limit]": "1000",
      });

      if (nextCursor) {
        queryParams.set("page[cursor]", nextCursor);
      }

      const response = await fetch(
        `https://api.datadoghq.com/api/v2/logs/events/search?${queryParams.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": process.env.DATADOG_API_KEY!,
            "DD-APPLICATION-KEY": process.env.DATADOG_APP_KEY!,
          },
          body: JSON.stringify({
            filter: {
              query: "service:xmtp-qa-tools",
              from: fromTime,
              to: toTime,
            },
            sort: "-timestamp",
            page: {
              limit: 1000,
              cursor: nextCursor,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Datadog API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as DatadogLogsResponse;
      allLogs.push(...data.data);

      nextCursor = data.meta?.page?.after;
    } while (nextCursor);

    // Process logs and extract test failures
    const testFailures: TestFailure[] = allLogs
      .filter((log) => {
        const message = log.attributes.message || "";
        const hasTestContext = log.attributes.attributes.test;
        const isErrorLevel = log.attributes.attributes.level === "error";
        return (
          hasTestContext &&
          isErrorLevel &&
          (message.includes("failed") ||
            message.includes("error") ||
            message.includes("Error") ||
            message.includes("FAIL"))
        );
      })
      .map((log) => {
        const message = log.attributes.message || "";
        const attrs = log.attributes.attributes;

        return {
          testName: attrs.test || extractTestNameFromMessage(message),
          environment: attrs.env || null,
          geolocation: attrs.region || null,
          timestamp: log.attributes.timestamp || null,
          workflowUrl: extractUrlFromMessage(message, "github.com") || null,
          dashboardUrl: extractUrlFromMessage(message, "dashboard") || null,
          customLinks: extractUrlFromMessage(message, "agents") || null,
          errorLogs: message.split("\n").filter((line) => line.trim()),
        };
      });

    // Remove duplicates based on test name and timestamp
    const uniqueFailures = testFailures.filter((failure, index, array) => {
      return (
        array.findIndex(
          (f) =>
            f.testName === failure.testName &&
            f.timestamp === failure.timestamp,
        ) === index
      );
    });

    // Save to file
    const data = {
      metadata: {
        source: "datadog-logs",
        date: new Date().toISOString(),
        totalTestFailures: uniqueFailures.length,
        queryPeriod: {
          from: fromTime,
          to: toTime,
        },
      },
      testFailures: uniqueFailures,
    };

    const filepath = path.join(__dirname, "issues.json");
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    // Verify
    expect(fs.existsSync(filepath)).toBe(true);
    expect(uniqueFailures.length).toBeGreaterThanOrEqual(0);

    console.log(
      `✅ Extracted ${uniqueFailures.length} test failures from Datadog logs`,
    );
    console.log(`📊 Processed ${allLogs.length} total log entries`);
  }, 30000);

  // Helper functions
  function extractTestNameFromMessage(message: string): string | null {
    // Try to extract test name from various patterns in the message
    const patterns = [/Test:\s*([^\n]+)/i, /test[:\s]+([^\n]+)/i, /^([^:]+):/];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  function extractUrlFromMessage(
    message: string,
    urlType: string,
  ): string | null {
    const urlPattern = new RegExp(`https?://[^\\s]*${urlType}[^\\s]*`, "i");
    const match = message.match(urlPattern);
    return match ? match[0] : null;
  }
});
