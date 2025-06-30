import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { PATTERNS } from "@helpers/analyzer";
import fetch from "node-fetch";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface ProcessedLogEntry {
  id: string;
  type: string;
  environment: string | null;
  test: string | null;
  level: string | null;
  service: string;
  region: string | null;
  env: string | null;
  message: string[];
}

export interface ProcessLogsResult {
  allLogs: DatadogLogEntry[];
  testFailures: ProcessedLogEntry[];
  metadata: {
    source: string;
    date: string;
    totalTestFailures: number;
    totalLogEntries: number;
    queryPeriod: {
      from: string;
      to: string;
    };
  };
}

export const SYSTEM_PROMPT = `You are a friendly expert at analyzing test failure data and logs.

# How to read the logs
- Pay attention ot the lines that contain FAIL on them, those indicate that a certain test has failed. The other lines show error logs from the rust libary beneath, whoch could be bening or not.

# How to answer
- **BE CONCISE**: Provide clear, actionable insights in 2-3 paragraphs maximum
- Focus on the most critical patterns and status reports
- Identify just symptoms and don't provide recommendations unless specifically asked
- Be aware of known issues and don't repeat them
- Don't repeat the same information in the logs, just summarize the most important information

# FORMATTING REQUIREMENTS:
- Use Slack markdown formatting in your responses
- Use *bold text* for emphasis and important points
- Use \`code blocks\` for technical terms, error names, and specific values
- Use \`\`\`code blocks\`\`\` for longer code snippets or logs
- Use bullet points with • for lists
- Use > for important quotes or callouts
- **Keep responses under 500 words**
- Structure responses with clear sections using *bold headers*

# DUPLICATED PATTERNS
This patterns may appear multiple times in the logs, but they are the same issue, some of them are known issues, some of them are not.
${PATTERNS.DEDUPE.map((pattern) => `- ${JSON.stringify(pattern)}`).join("\n")}

# KNOWN ISSUES
These are known issues that have been reported and are being worked on.
${PATTERNS.KNOWN_ISSUES.map((issue) => `- ${JSON.stringify(issue)}`).join("\n")}`;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "test-key",
});

// Real Claude API call
export async function askClaude(prompt: string, data: string): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return `[MOCK MODE - No API Key] Claude would analyze: "${prompt}" with system prompt and data sample: ${data.substring(0, 100)}...`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${prompt}

Here is the test failure data to analyze:

${data}`,
        },
      ],
    });

    return message.content[0].type === "text"
      ? message.content[0].text
      : "No response";
  } catch (error) {
    console.error("Claude API Error:", error);
    return `Error calling Claude API: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function readIssuesData(): string | null {
  try {
    const issuesPath = path.join(__dirname, "issues.json");
    return fs.readFileSync(issuesPath, "utf8");
  } catch (error) {
    console.error("Error reading issues.json:", error);
    return null;
  }
}

// Format response for Slack with additional enhancements
export function formatSlackResponse(response: string): string {
  // Add some visual separators and emojis for better readability
  let formatted = response;

  // Add emoji indicators for different types of content
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "*$1*"); // Convert ** to * for Slack bold
  formatted = formatted.replace(/^(ERROR|FAILED|FAILURE)/gim, "🚨 $1");
  formatted = formatted.replace(/^(SUCCESS|PASSED|WORKING)/gim, "✅ $1");
  formatted = formatted.replace(/^(WARNING|WARN)/gim, "⚠️ $1");
  formatted = formatted.replace(/^(INFO|NOTE)/gim, "ℹ️ $1");

  // Ensure proper spacing around code blocks
  formatted = formatted.replace(/```([^`]+)```/g, "\n```$1```\n");

  return formatted.trim();
}

// Datadog Log Processing Class
export class DatadogLogProcessor {
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

    // Default to last 4 hours
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    return {
      from: fourHoursAgo.toISOString(),
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
            "DD-API-KEY": process.env.DATADOG_API_KEY as string,
            "DD-APPLICATION-KEY": process.env.DATADOG_APP_KEY as string,
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

  private processLogsToFlatFormat(
    logs: DatadogLogEntry[],
  ): ProcessedLogEntry[] {
    return logs
      .filter((log) => this.isTestFailureLog(log))
      .map((log) => {
        const rawMessage = (log.attributes.message as string) || "";
        const attrs = log.attributes.attributes || {};

        // Format message as array of lines for better readability
        const messageLines = rawMessage
          .replace(/\\n/g, "\n") // Convert literal \n to actual line breaks
          .split("\n") // Split into array of lines
          .map((line) => line.trim()) // Trim whitespace from each line
          .filter((line) => line.length > 0); // Remove empty lines

        return {
          id: log.id,
          type: log.type,
          environment: (attrs.env as string) || null,
          test: (attrs.test as string) || null,
          level: (attrs.level as string) || null,
          service: (attrs.service as string) || this.service,
          region: (attrs.region as string) || null,
          env: (attrs.env as string) || null,
          message: messageLines,
        };
      })
      .filter((entry) => {
        const entryJson = JSON.stringify(entry);
        if (entryJson.length > 5000) {
          console.log(
            `Skipping large log entry: ${entryJson.length} characters (limit: 5000)`,
          );
          return false;
        }
        return true;
      });
  }

  private removeDuplicateFailures(
    failures: ProcessedLogEntry[],
  ): ProcessedLogEntry[] {
    return failures.filter((failure, index, array) => {
      return (
        array.findIndex(
          (f) => f.test === failure.test && f.id === failure.id,
        ) === index
      );
    });
  }

  private saveToFile(data: ProcessedLogEntry[], outputPath?: string): void {
    const filepath = outputPath || this.outputPath;
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  }

  public async processLogs(
    options?: DatadogLogOptions,
  ): Promise<ProcessLogsResult> {
    this.validateApiKeys();

    // Clear/create fresh file at the start of each refresh
    const filepath = options?.outputPath || this.outputPath;
    fs.writeFileSync(filepath, JSON.stringify([], null, 2));
    console.log(`Created fresh file: ${filepath}`);

    const allLogs = await this.fetchAllLogs(options);
    const testFailures = this.processLogsToFlatFormat(allLogs);
    const uniqueFailures = this.removeDuplicateFailures(testFailures);
    const timeRange = this.getTimeRange(options);

    // Save the processed data to the fresh file
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
  testFailures: ProcessedLogEntry[];
  metadata: ProcessLogsResult["metadata"];
}> {
  const processor = new DatadogLogProcessor();
  return await processor.processLogs(options);
}
