import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { beforeAll, describe, expect, it } from "vitest";

dotenv.config();

// Type definitions for Datadog functionality
export interface DatadogLogEntry {
  id: string;
  type: string;
  attributes: {
    timestamp?: string;
    message?: string;
    service?: string;
    status?: string;
    attributes?: {
      test?: string;
      region?: string;
      env?: string;
      libxmtp?: string;
      service?: string;
      level?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
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

export interface TestFailure {
  testName: string | null;
  environment: string | null;
  geolocation: string | null;
  timestamp: string | null;
  workflowUrl: string | null;
  dashboardUrl: string | null;
  customLinks: string | null;
  errorLogs: string[];
}

export interface DatadogLogOptions {
  timeRange?: {
    from?: string;
    to?: string;
  };
  service?: string;
  outputPath?: string;
}

class DatadogLogProcessor {
  private readonly service: string;
  private readonly outputPath: string;

  constructor() {
    this.service = "xmtp-qa-tools";
    this.outputPath = path.join(__dirname, "issues.json");
  }

  private validateApiKeys(): void {
    if (!process.env.DATADOG_API_KEY) {
      throw new Error("DATADOG_API_KEY environment variable is required");
    }
    if (!process.env.DATADOG_APP_KEY) {
      throw new Error("DATADOG_APP_KEY environment variable is required");
    }
  }

  private getTimeRange(options?: DatadogLogOptions) {
    if (options?.timeRange?.from && options?.timeRange?.to) {
      return {
        from: options.timeRange.from,
        to: options.timeRange.to,
      };
    }

    // Default to today's range
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return {
      from: startOfToday.toISOString(),
      to: now.toISOString(),
    };
  }

  private async fetchAllLogs(
    options?: DatadogLogOptions,
  ): Promise<DatadogLogEntry[]> {
    const timeRange = this.getTimeRange(options);
    const service = options?.service || this.service;
    const allLogs: DatadogLogEntry[] = [];
    let nextCursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        "filter[query]": `service:${service}`,
        "filter[from]": timeRange.from,
        "filter[to]": timeRange.to,
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
              query: `service:${service}`,
              from: timeRange.from,
              to: timeRange.to,
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

    return allLogs;
  }

  private isTestFailureLog(log: DatadogLogEntry): boolean {
    const message = (log.attributes.message as string) || "";
    const hasTestContext = Boolean(log.attributes.attributes?.test);
    const isErrorLevel = log.attributes.attributes?.level === "error";

    return (
      hasTestContext &&
      isErrorLevel &&
      typeof message === "string" &&
      (message.includes("failed") ||
        message.includes("error") ||
        message.includes("Error") ||
        message.includes("FAIL"))
    );
  }

  private processLogsToFlatFormat(logs: DatadogLogEntry[]): any[] {
    return logs
      .filter((log) => this.isTestFailureLog(log))
      .map((log) => {
        const message = (log.attributes.message as string) || "";
        const attrs = log.attributes.attributes || {};

        return {
          id: log.id,
          type: log.type,
          environment: (attrs.env as string) || null,
          test: (attrs.test as string) || null,
          level: (attrs.level as string) || null,
          service: (attrs.service as string) || this.service,
          region: (attrs.region as string) || null,
          env: (attrs.env as string) || null,
          libxmtp: (attrs.libxmtp as string) || null,
          message: message,
        };
      });
  }

  private removeDuplicateFailures(failures: any[]): any[] {
    return failures.filter((failure, index, array) => {
      return (
        array.findIndex(
          (f) => f.testName === failure.testName && f.id === failure.id,
        ) === index
      );
    });
  }

  private saveToFile(data: any, outputPath?: string): void {
    const filepath = outputPath || this.outputPath;
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  private extractTestNameFromMessage(message: string): string | null {
    const patterns = [/Test:\s*([^\n]+)/i, /test[:\s]+([^\n]+)/i, /^([^:]+):/];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  public async processLogs(options?: DatadogLogOptions): Promise<{
    allLogs: DatadogLogEntry[];
    testFailures: any[];
    metadata: any;
  }> {
    this.validateApiKeys();

    const allLogs = await this.fetchAllLogs(options);
    const testFailures = this.processLogsToFlatFormat(allLogs);
    const uniqueFailures = this.removeDuplicateFailures(testFailures);
    const timeRange = this.getTimeRange(options);

    // Save directly as an array in the desired format
    this.saveToFile(uniqueFailures, options?.outputPath);

    return {
      allLogs,
      testFailures: uniqueFailures,
      metadata: {
        source: "datadog-logs",
        date: new Date().toISOString(),
        totalTestFailures: uniqueFailures.length,
        totalLogEntries: allLogs.length,
        queryPeriod: timeRange,
      },
    };
  }
}

// Public API - keep it simple
export async function processDatadogLogs(options?: DatadogLogOptions): Promise<{
  allLogs: DatadogLogEntry[];
  testFailures: TestFailure[];
  metadata: any;
}> {
  const processor = new DatadogLogProcessor();
  return await processor.processLogs(options);
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
