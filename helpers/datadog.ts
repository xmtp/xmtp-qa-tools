import "dotenv/config";
import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";

// Consolidated interfaces
interface MetricData {
  values: number[];
  members?: string;
}

interface ParsedTestName {
  metricName: string;
  metricDescription: string;
  testNameExtracted: string;
  operationType: "group" | "core";
  operationName: string;
  members: string;
  conversation_count: string;
}

// Simplified metric tags interface - consolidates all previous metric tag types
interface MetricTags {
  metric_type: string;
  metric_subtype: string;
  branch?: string;
  env?: string;
  region?: string;
  sdk: string;
  operation?: string;
  test?: string;
  country_iso_code?: string;
  members?: string;
  conversation_count?: string;
}
export interface DeliveryMetricTags extends MetricTags {
  metric_type: "delivery" | "order";
  metric_subtype: "stream" | "poll" | "recovery";
  conversation_type: "dm" | "group";
}
export interface NetworkMetricTags extends MetricTags {
  metric_type: "network";
  metric_subtype: "phase";
  network_phase:
    | "dns_lookup"
    | "tcp_connection"
    | "tls_handshake"
    | "server_call"
    | "processing";
}

export interface ResponseMetricTags extends MetricTags {
  agent?: string;
  address?: string;
  live?: string;
  status?: string;
}

// Legacy interface exports for backward compatibility
export interface DurationMetricTags extends MetricTags {
  metric_type: "operation";
  metric_subtype: "group" | "core";
  operation: string;
  members: string;
  installations: string;
  conversation_count: string;
}
interface LogPayload {
  metric_type: "log";
  metric_subtype: "test";
  level: "error";
  service: string;
  source: string;
  branch: string;
  message: string;
  error_count: number;
  fail_lines: number;
  test: string;
  workflowRunUrl: string;
  env: string;
  region: string;
  country_iso_code: string;
  batch_size: string | undefined;
}
interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  Processing: number;
  "Server Call": number;
}

export const GEO_TO_COUNTRY_CODE = {
  "us-east": "US",
  "us-east-1": "US",
  europe: "FR",
  asia: "JP",
  "south-america": "BR",
} as const;

// Global state
const state = {
  isInitialized: false,
  collectedMetrics: {} as Record<string, MetricData>,
};

const execAsync = promisify(exec);

// Utility functions
export const calculateAverage = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, val) => sum + val, 0) / values.length;

// Tag enrichment helper
function enrichTags(tags: MetricTags): MetricTags {
  return {
    ...tags,
    env: tags.env || process.env.XMTP_ENV,
    region: tags.region || process.env.REGION,
    country_iso_code:
      tags.country_iso_code ||
      GEO_TO_COUNTRY_CODE[
        process.env.REGION as keyof typeof GEO_TO_COUNTRY_CODE
      ],
  };
}

// Operation key generator
function getOperationKey(tags: MetricTags, metricName: string): string {
  const memberCount = tags.members || "";
  return tags.operation
    ? `${tags.operation}${memberCount ? `-${memberCount}` : ""}`
    : metricName;
}

export function initializeDatadog(): boolean {
  if (!process.env.DATADOG_API_KEY) {
    console.warn("⚠️ DATADOG_API_KEY not found - metrics will not be sent");
    return false;
  }
  if (state.isInitialized) return true;

  try {
    metrics.init({
      apiKey: process.env.DATADOG_API_KEY,
      // Configure histogram defaults to include p95
      histogram: {
        aggregates: ["sum", "avg", "count", "min", "max"],
        percentiles: [0.95], // This will create p95 metrics
      },
    });
    state.isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize DataDog metrics:", error);
    return false;
  }
}

// Core metric sending function
export function sendMetric(
  metricName: string,
  metricValue: number,
  tags: MetricTags,
): void {
  try {
    if (metricValue <= 0) {
      console.error(`❌ Metric value is 0 or negative: ${metricName}`);
      return;
    }
    const enrichedTags = enrichTags(tags);
    const fullMetricName = `xmtp.sdk.${metricName}`;
    const operationKey = getOperationKey(enrichedTags, metricName);

    // Collect metrics for summary
    if (!state.collectedMetrics[operationKey]) {
      state.collectedMetrics[operationKey] = {
        values: [],
        members: enrichedTags.members || "",
      };
    }
    state.collectedMetrics[operationKey].values.push(metricValue);

    // Format tags for DataDog
    const formattedTags = Object.entries(enrichedTags)
      .map(([key, value]) => `${key}:${String(value || "").trim()}`)
      .filter((tag) => !tag.endsWith(":"));

    // Debug logging (exclude network metrics to reduce noise)
    if (enrichedTags.metric_type !== "network") {
      console.debug(
        JSON.stringify(
          {
            metricName: fullMetricName,
            metricValue: Math.round(metricValue),
            tags: formattedTags,
          },
          null,
          2,
        ),
      );
    }

    metrics.gauge(fullMetricName, Math.round(metricValue), formattedTags);

    // Also send as histogram for p95 calculation (duration metrics only)
    if (
      enrichedTags.metric_type === "operation" ||
      enrichedTags.metric_type === "delivery"
    ) {
      metrics.histogram(fullMetricName, Math.round(metricValue), formattedTags);
    }
  } catch (error) {
    console.error(
      `❌ Error sending metric '${metricName}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Send histogram metric for p95 calculation
export function sendHistogramMetric(
  metricName: string,
  metricValue: number,
  tags: MetricTags,
): void {
  try {
    if (metricValue <= 0) {
      console.error(
        `❌ Histogram metric value is 0 or negative: ${metricName}`,
      );
      return;
    }
    const enrichedTags = enrichTags(tags);
    const fullMetricName = `xmtp.sdk.${metricName}`;

    // Format tags for DataDog
    const formattedTags = Object.entries(enrichedTags)
      .map(([key, value]) => `${key}:${String(value || "").trim()}`)
      .filter((tag) => !tag.endsWith(":"));

    // Debug logging
    console.debug(
      JSON.stringify(
        {
          histogramMetricName: fullMetricName,
          metricValue: Math.round(metricValue),
          tags: formattedTags,
        },
        null,
        2,
      ),
    );

    metrics.histogram(fullMetricName, Math.round(metricValue), formattedTags);
  } catch (error) {
    console.error(
      `❌ Error sending histogram metric '${metricName}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Test name parsing - simplified
export function parseTestName(testName: string): ParsedTestName {
  const [metricNameParts, metricDescription = ""] = testName.split(":");
  const metricName = metricNameParts.replaceAll(" > ", ".");
  const operationParts = metricName.split(".");

  let testNameExtracted = operationParts[0];

  let operationName = "";
  let members = "";
  let conversation_count = "";

  if (operationParts[1]) {
    // Updated regex to handle optional conversation_count size: operationName-number(conversation_countSize)
    const match = operationParts[1].match(/^([a-zA-Z]+)-?(\d+)?\(?(\d+)?\)?$/);
    if (match) {
      [, operationName, members = "", conversation_count = ""] = match;
    } else {
      operationName = operationParts[1];
    }
  }

  return {
    metricName,
    metricDescription,
    testNameExtracted,
    operationType: parseInt(members) > 5 ? "group" : "core",
    operationName,
    members,
    conversation_count,
  };
}

// Network statistics - streamlined
export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}}" -o /dev/null --max-time 10 ${endpoint}`;

  try {
    const { stdout } = await execAsync(curlCommand);
    const stats = JSON.parse(stdout.trim()) as NetworkStats;

    // Fix zero server call time
    if (stats["Server Call"] === 0) {
      console.warn(
        `Network request to ${endpoint} returned Server Call time of 0.`,
      );
      stats["Server Call"] = stats["TLS Handshake"] + 0.1;
    }

    stats["Processing"] = Math.max(
      0,
      stats["Server Call"] - stats["TLS Handshake"],
    );
    return stats;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "stdout" in error &&
      typeof error.stdout === "string"
    ) {
      console.warn(`⚠️ Curl command returned error but stdout available.`);
      const stats = JSON.parse(error.stdout.trim()) as NetworkStats;
      stats["Processing"] = Math.max(
        0,
        stats["Server Call"] - stats["TLS Handshake"],
      );
      return stats;
    }
    console.error(`❌ Curl command failed:`, error);
    throw error;
  }
}

// Utility functions
export function flushMetrics(): Promise<void> {
  return state.isInitialized ? metrics.flush() : Promise.resolve();
}

// Datadog log sending - optimized
export async function sendDatadogLog(
  errorLogs: string[],
  fail_lines: string[],
  testName: string,
): Promise<void> {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) return;
  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.warn(`Slack notification skipped (branch: ${branchName})`);
    return;
  }
  if (process.env.REGION === "south-america") {
    return;
  }
  const logPayload: LogPayload = {
    metric_type: "log",
    metric_subtype: "test",
    level: "error",
    service: "xmtp-qa-tools",
    branch: branchName,
    source: "xmtp-qa-tools",
    error_count: Array.from(errorLogs).length,
    fail_lines: fail_lines.length,
    batch_size: process.env.BATCH_SIZE || undefined,
    message: Array.from(errorLogs).join("\n"),
    test: testName,
    workflowRunUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    env: process.env.XMTP_ENV || "unknown",
    region: process.env.REGION || "unknown",
    country_iso_code:
      GEO_TO_COUNTRY_CODE[
        process.env.REGION as keyof typeof GEO_TO_COUNTRY_CODE
      ],
  };
  //console.debug(logPayload);
  try {
    await fetch("https://http-intake.logs.datadoghq.com/v1/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": process.env.DATADOG_API_KEY || "",
      },
      body: JSON.stringify(logPayload),
    });
  } catch (error) {
    console.error("❌ Failed to send Datadog log:", error);
  }
}
