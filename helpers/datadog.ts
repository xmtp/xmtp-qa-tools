import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";
import {
  checkForCriticalErrors,
  extractErrorLogs,
  extractfail_lines,
} from "./analyzer";

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
}

// Simplified metric tags interface - consolidates all previous metric tag types
interface MetricTags {
  metric_type: string;
  metric_subtype: string;
  env?: string;
  region?: string;
  sdk: string;
  operation?: string;
  test?: string;
  country_iso_code?: string;
  members?: string;
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
}

// Legacy interface exports for backward compatibility
export interface DurationMetricTags extends MetricTags {
  metric_type: "operation";
  metric_subtype: "group" | "core";
  operation: string;
  installations?: string;
  members?: string;
}
interface LogPayload {
  metric_type: "log";
  metric_subtype: "test";
  level: "error";
  service: string;
  source: string;
  message: string;
  error_count: number;
  fail_lines: number;
  test: string;
  workflowRunUrl: string;
  environment: string;
  env: string;
  region: string;
  country_iso_code: string;
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
  "us-west": "US",
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
    region: tags.region || process.env.GEOLOCATION,
    country_iso_code:
      tags.country_iso_code ||
      GEO_TO_COUNTRY_CODE[
        process.env.GEOLOCATION as keyof typeof GEO_TO_COUNTRY_CODE
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

// DataDog initialization
export function initDataDog(): boolean {
  if (!process.env.DATADOG_API_KEY) {
    console.warn("⚠️ DATADOG_API_KEY not found - metrics will not be sent");
    return false;
  }
  if (state.isInitialized) return true;

  try {
    metrics.init({ apiKey: process.env.DATADOG_API_KEY });
    state.isInitialized = true;
    console.debug("✅ DataDog metrics initialized successfully");
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
    const enrichedTags = enrichTags(tags);
    const fullMetricName = `xmtp.sdk.${metricName}`;
    const operationKey = getOperationKey(enrichedTags, metricName);

    // Collect metrics for summary
    if (!state.collectedMetrics[operationKey]) {
      state.collectedMetrics[operationKey] = {
        values: [],
        members: enrichedTags.members,
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
  } catch (error) {
    console.error(
      `❌ Error sending metric '${metricName}':`,
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
  if (testNameExtracted.includes("large_")) {
    testNameExtracted = "large";
  }

  let operationName = "";
  let members = "";

  if (operationParts[1]) {
    const match = operationParts[1].match(/^([a-zA-Z]+)-?(\d+)?$/);
    if (match) {
      [, operationName, members = ""] = match;
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
  logFileName: string,
  testName: string,
): Promise<void> {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) return;

  const errorLogs = extractErrorLogs(logFileName);
  const fail_lines = extractfail_lines(errorLogs);
  checkForCriticalErrors(testName, fail_lines);
  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.warn(`Slack notification skipped (branch: ${branchName})`);
    return;
  }

  if (!errorLogs || errorLogs.size === 0) {
    console.warn("No error logs, skipping");
    return;
  }

  if (Array.isArray(fail_lines) && fail_lines.length === 0) {
    console.warn("No fail_lines logs, skipping");
    return;
  }
  const logPayload: LogPayload = {
    metric_type: "log",
    metric_subtype: "test",
    level: "error",
    service: "xmtp-qa-tools",
    source: "xmtp-qa-tools",
    error_count: Array.from(errorLogs).length,
    fail_lines: fail_lines.length,
    message: Array.from(errorLogs).join("\n"),
    test: testName,
    workflowRunUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    environment: process.env.XMTP_ENV || "unknown",
    env: process.env.XMTP_ENV || "unknown",
    region: process.env.GEOLOCATION || "unknown",
    country_iso_code:
      GEO_TO_COUNTRY_CODE[
        process.env.GEOLOCATION as keyof typeof GEO_TO_COUNTRY_CODE
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
