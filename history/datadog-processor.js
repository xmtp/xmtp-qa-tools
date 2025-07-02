#!/usr/bin/env node

/**
 * Datadog Log Processor for XMTP QA Historical Data
 *
 * Processes Datadog logs and maintains issues.json without Slack dependencies.
 * Replaces the Slack bot's data collection functionality.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants from original Slack bot
const SERVICE = "xmtp-qa-tools";
const OUTPUT_PATH = path.join(__dirname, "issues.json");

// Known patterns for deduplication
const PATTERNS = {
  DEDUPE: [
    "sqlcipher_mlock",
    "Collector timed out.",
    "welcome with cursor",
    "group with welcome id",
    "receiveGroupMessage",
    "receiveNewConversation",
    "Skipping welcome",
    "Skipping already processed",
    "xmtp_mls::groups::key_package_cleaner_worker",
    "xmtp_mls::groups::mls_sync",
    "xmtp_mls::groups::welcome_sync",
  ],
};

class DatadogProcessor {
  constructor() {
    this.service = SERVICE;
    this.outputPath = OUTPUT_PATH;
  }

  validateApiKeys() {
    if (!process.env.DATADOG_API_KEY) {
      throw new Error("DATADOG_API_KEY environment variable is required");
    }
    if (!process.env.DATADOG_APP_KEY) {
      throw new Error("DATADOG_APP_KEY environment variable is required");
    }
  }

  getTimeRange(options = {}) {
    if (options.from && options.to) {
      return { from: options.from, to: options.to };
    }

    // Default to last 4 hours
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    return {
      from: fourHoursAgo.toISOString(),
      to: now.toISOString(),
    };
  }

  async fetchAllLogs(options = {}) {
    const timeRange = this.getTimeRange(options);
    const service = options.service || this.service;
    const allLogs = [];
    let nextCursor;

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
            "DD-API-KEY": process.env.DATADOG_API_KEY,
            "DD-APPLICATION-KEY": process.env.DATADOG_APP_KEY,
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

      const data = await response.json();
      allLogs.push(...data.data);
      nextCursor = data.meta?.page?.after;
    } while (nextCursor);

    return allLogs;
  }

  isTestFailureLog(log) {
    const message = log.attributes.message || "";
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

  processLogsToFlatFormat(logs) {
    return logs
      .filter((log) => this.isTestFailureLog(log))
      .map((log) => {
        const rawMessage = log.attributes.message || "";
        const attrs = log.attributes.attributes || {};

        // Format message as array of lines
        const messageLines = rawMessage
          .replace(/\\n/g, "\n")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        return {
          id: log.id,
          type: log.type,
          environment: attrs.env || null,
          test: attrs.test || null,
          level: attrs.level || null,
          service: attrs.service || this.service,
          region: attrs.region || null,
          env: attrs.env || null,
          libxmtp: attrs.libxmtp || null,
          message: messageLines,
        };
      })
      .filter((entry) => {
        const entryJson = JSON.stringify(entry);
        if (entryJson.length > 5000) {
          console.log(
            `Skipping large log entry: ${entryJson.length} characters`,
          );
          return false;
        }
        return true;
      });
  }

  removeDuplicateFailures(failures) {
    return failures.filter((failure, index, array) => {
      return (
        array.findIndex(
          (f) => f.test === failure.test && f.id === failure.id,
        ) === index
      );
    });
  }

  saveToFile(data, outputPath) {
    const filepath = outputPath || this.outputPath;
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.length} entries to ${filepath}`);
  }

  async processLogs(options = {}) {
    this.validateApiKeys();

    // Clear/create fresh file
    const filepath = options.outputPath || this.outputPath;
    fs.writeFileSync(filepath, JSON.stringify([], null, 2));
    console.log(`🔄 Processing Datadog logs for service: ${this.service}`);

    try {
      const allLogs = await this.fetchAllLogs(options);
      console.log(`📥 Fetched ${allLogs.length} total log entries`);

      const testFailures = this.processLogsToFlatFormat(allLogs);
      console.log(`🔍 Found ${testFailures.length} test failure entries`);

      const uniqueFailures = this.removeDuplicateFailures(testFailures);
      console.log(
        `✨ Deduplicated to ${uniqueFailures.length} unique failures`,
      );

      const timeRange = this.getTimeRange(options);

      // Save processed data
      this.saveToFile(uniqueFailures, filepath);

      const metadata = {
        source: "datadog-logs",
        date: new Date().toISOString(),
        totalTestFailures: uniqueFailures.length,
        totalLogEntries: allLogs.length,
        queryPeriod: timeRange,
      };

      // Save metadata separately
      const metadataPath = path.join(__dirname, "metadata.json");
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return { allLogs, testFailures: uniqueFailures, metadata };
    } catch (error) {
      console.error("❌ Error processing logs:", error);
      throw error;
    }
  }

  // Generate summary statistics
  generateSummary(data) {
    const summary = {
      totalFailures: data.length,
      byTest: {},
      byEnvironment: {},
      byRegion: {},
      recentFailures: [],
    };

    data.forEach((entry) => {
      // Count by test type
      if (entry.test) {
        summary.byTest[entry.test] = (summary.byTest[entry.test] || 0) + 1;
      }

      // Count by environment
      if (entry.environment) {
        summary.byEnvironment[entry.environment] =
          (summary.byEnvironment[entry.environment] || 0) + 1;
      }

      // Count by region
      if (entry.region) {
        summary.byRegion[entry.region] =
          (summary.byRegion[entry.region] || 0) + 1;
      }

      // Collect recent FAIL lines
      entry.message.forEach((msg) => {
        if (msg.includes("FAIL")) {
          summary.recentFailures.push({
            test: entry.test,
            environment: entry.environment,
            failure: msg,
          });
        }
      });
    });

    return summary;
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace("--", "");
    const value = args[i + 1];
    if (key && value) {
      options[key] = value;
    }
  }

  const processor = new DatadogProcessor();

  try {
    console.log("🚀 Starting Datadog log processing...\n");
    const result = await processor.processLogs(options);

    console.log("\n📊 Processing Summary:");
    const summary = processor.generateSummary(result.testFailures);

    console.log(`- Total Failures: ${summary.totalFailures}`);
    console.log(`- Test Types: ${Object.keys(summary.byTest).join(", ")}`);
    console.log(
      `- Environments: ${Object.keys(summary.byEnvironment).join(", ")}`,
    );
    console.log(
      `- Time Range: ${result.metadata.queryPeriod.from} to ${result.metadata.queryPeriod.to}`,
    );

    if (summary.recentFailures.length > 0) {
      console.log("\n🔴 Recent Failures:");
      summary.recentFailures.slice(0, 5).forEach((failure) => {
        console.log(
          `  - [${failure.test}/${failure.environment}] ${failure.failure}`,
        );
      });
    }

    console.log(
      "\n✅ Processing complete! Data available in history/issues.json",
    );
  } catch (error) {
    console.error("\n❌ Processing failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DatadogProcessor };
