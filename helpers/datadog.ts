import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";
import fetch from "node-fetch";
import { extractFailLines, shouldFilterOutTest } from "./analyzer";

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

// Metric type interfaces
interface BaseMetricTags {
  metric_type: "agent" | "operation" | "network" | "delivery" | "response";
  metric_subtype?: string;
  env?: string;
  region?: string;
  sdk: string;
  operation?: string;
  test: string;
  country_iso_code?: string;
}

export interface DurationMetricTags extends BaseMetricTags {
  metric_type: "operation";
  metric_subtype: "group" | "core";
  operation: string;
  installations: string;
  members: string;
}

interface NetworkMetricTags extends BaseMetricTags {
  metric_type: "network";
  metric_subtype:
    | "dns_lookup"
    | "tcp_connection"
    | "tls_handshake"
    | "server_call"
    | "processing";
  operation: string;
  network_phase:
    | "dns_lookup"
    | "tcp_connection"
    | "tls_handshake"
    | "server_call"
    | "processing";
}

interface DeliveryMetricTags extends BaseMetricTags {
  metric_type: "delivery";
  message_id?: string;
  conversation_type: "dm" | "group";
  delivery_status: "sent" | "received" | "failed";
  members?: string;
}

interface ResponseMetricTags extends BaseMetricTags {
  metric_type: "agent";
  metric_subtype: string;
  agent?: string;
  address?: string;
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
};
// Global state with proper initialization
const state = {
  isInitialized: false,
  collectedMetrics: {} as Record<string, MetricData>,
};

/**
 * Calculate average of numeric values
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Group metrics by operation name and member count
 */
export function groupMetricsByOperation(
  metrics: [string, MetricData][],
): Map<
  string,
  { operationName: string; members: string; operationData: MetricData }
> {
  const groups = new Map();

  for (const [operation, data] of metrics) {
    // Use the operation parsing logic from parseTestName for consistency
    const parts = operation.split(":");
    const operationPart = parts[0];
    const dashMatch = operationPart.match(/^([a-zA-Z]+)-(\d+)$/);

    const operationName = dashMatch ? dashMatch[1] : operationPart;
    const memberCount = dashMatch ? dashMatch[2] : data.members || "-";
    const groupKey = `${operationName}-${memberCount}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        operationName,
        members: memberCount,
        operationData: null,
      });
    }

    groups.get(groupKey).operationData = data;
  }

  return groups as Map<
    string,
    { operationName: string; members: string; operationData: MetricData }
  >;
}

// DataDog integration
/**
 * Initialize DataDog metrics reporting
 */
export function initDataDog(): boolean {
  if (!process.env.DATADOG_API_KEY) return false;
  if (state.isInitialized) {
    return true;
  }

  try {
    const initConfig = {
      apiKey: process.env.DATADOG_API_KEY,
    };

    metrics.init(initConfig);
    state.isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize DataDog metrics:", error);
    return false;
  }
}

// Union type for all metric tag types
type MetricTags =
  | DurationMetricTags
  | DeliveryMetricTags
  | ResponseMetricTags
  | NetworkMetricTags;

/**
 * Send a metric to DataDog and collect for summary
 */
export function sendMetric(
  metricName: string,
  metricValue: number,
  tags: MetricTags,
): void {
  if (!state.isInitialized) return;

  try {
    // Auto-populate environment fields if not provided
    const enrichedTags: MetricTags = {
      ...tags,
      env: tags.env || (process.env.XMTP_ENV as string),
      region: tags.region || (process.env.GEOLOCATION as string),
      country_iso_code:
        tags.country_iso_code ||
        GEO_TO_COUNTRY_CODE[
          process.env.GEOLOCATION as keyof typeof GEO_TO_COUNTRY_CODE
        ],
    };

    const fullMetricName = `xmtp.sdk.${metricName}`;
    const allTags = Object.entries(enrichedTags).map(
      ([key, value]) => `${key}:${String(value)}`,
    );

    // Create a distinctive operation key that properly includes member count
    // Format: operation_name-member_count (e.g., "createGroup-10")
    const memberCount =
      "members" in enrichedTags ? enrichedTags.members || "" : "";
    const operationKey =
      "operation" in enrichedTags && enrichedTags.operation
        ? `${enrichedTags.operation}${memberCount ? `-${memberCount}` : ""}`
        : metricName;

    if (!state.collectedMetrics[operationKey]) {
      state.collectedMetrics[operationKey] = {
        values: [],
        members: memberCount,
      };
    }

    state.collectedMetrics[operationKey].values.push(metricValue);

    if (enrichedTags.metric_type !== "network") {
      console.debug(
        JSON.stringify(
          {
            metricName: fullMetricName,
            metricValue: Math.round(metricValue),
            tags: allTags,
          },
          null,
          2,
        ),
      );
    }
    // Trim whitespace from all tag values
    const trimmedTags = allTags.map((tag) => {
      const [key, value] = tag.split(":");
      return `${key}:${value?.trim() || ""}`;
    });

    metrics.gauge(fullMetricName, Math.round(metricValue), trimmedTags);
  } catch (error) {
    console.error(
      `❌ Error sending metric '${metricName}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Send a typed duration metric for performance measurements
 */
export function sendDurationMetric(
  metricValue: number,
  tags: DurationMetricTags,
): void {
  const enhancedTags: DurationMetricTags = {
    ...tags,
    env: tags.env || (process.env.XMTP_ENV as string),
    region: tags.region || (process.env.GEOLOCATION as string),
  };

  sendMetric("duration", metricValue, enhancedTags);
}

/**
 * Send a typed delivery metric for message delivery tracking
 */
export function sendDeliveryMetric(
  metricValue: number,
  tags: DeliveryMetricTags,
): void {
  const enhancedTags: DeliveryMetricTags = {
    ...tags,
    metric_type: "delivery",
    env: tags.env || (process.env.XMTP_ENV as string),
    region: tags.region || (process.env.GEOLOCATION as string),
  };

  sendMetric("delivery", metricValue, enhancedTags);
}

/**
 * Send a typed response metric for API/network response measurements
 */
export function sendResponseMetric(
  metricValue: number,
  tags: ResponseMetricTags,
): void {
  const enhancedTags: ResponseMetricTags = {
    ...tags,
    metric_type: "agent",
    env: tags.env || (process.env.XMTP_ENV as string),
    region: tags.region || (process.env.GEOLOCATION as string),
  };

  sendMetric("response", metricValue, enhancedTags);
}

/**
 * Extract operation details from test name
 */
export function parseTestName(testName: string): ParsedTestName {
  const metricNameParts = testName.split(":")[0];
  const metricName = metricNameParts.replaceAll(" > ", ".");
  const metricDescription = testName.split(":")[1] || "";
  const operationParts = metricName.split(".");
  let testNameExtracted = operationParts[0];

  if (testNameExtracted.includes("m_large")) {
    testNameExtracted = "m_large";
  }

  // Extract operation name and member count
  let operationName = "";
  let members = "";

  if (operationParts[1]) {
    // Check formats: "operation-10" and "operation10"
    const dashMatch = operationParts[1].match(/^([a-zA-Z]+)-(\d+)$/);
    const noSeparatorMatch = operationParts[1].match(/^([a-zA-Z]+)(\d+)$/);

    if (dashMatch) {
      operationName = dashMatch[1];
      members = dashMatch[2];
    } else if (noSeparatorMatch) {
      operationName = noSeparatorMatch[1];
      members = noSeparatorMatch[2];
    } else {
      operationName = operationParts[1];
    }
  }

  const operationType = parseInt(members) > 5 ? "group" : "core";

  return {
    metricName,
    metricDescription,
    testNameExtracted,
    operationType,
    operationName,
    members,
  };
}

// Network performance
const execAsync = promisify(exec);

/**
 * Measure network performance to an endpoint
 */
export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}}" -o /dev/null --max-time 10 ${endpoint}`;

  let stdout: string;

  try {
    const result = await execAsync(curlCommand);
    stdout = result.stdout;
  } catch (error: unknown) {
    if (error instanceof Error && "stdout" in error) {
      stdout = error.stdout as string;
      console.warn(
        `⚠️ Curl command returned error code ${String(error)}, but stdout is available.`,
      );
    } else {
      console.error(`❌ Curl command failed without stdout:`, error);
      throw error; // rethrow if no stdout is available
    }
  }
  const stats = JSON.parse(stdout.trim()) as NetworkStats;
  if (stats["Server Call"] === 0) {
    console.warn(
      `Network request to ${endpoint} returned Server Call time of 0.`,
    );
    stats["Server Call"] = stats["TLS Handshake"] + 0.1;
  }
  stats["Processing"] = stats["Server Call"] - stats["TLS Handshake"];
  if (stats["Processing"] < 0) stats["Processing"] = 0;

  return stats;
}

/**
 * Flush all metrics and generate summary report
 */
export function flushMetrics(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!state.isInitialized) {
      resolve();
      return;
    }
    void metrics.flush().then(() => {
      resolve();
    });
  });
}

/**
 * Send a log line to Datadog Logs Intake API
 */
export async function sendDatadogLog(
  lines: string[],
  context: Record<string, unknown> = {},
): Promise<void> {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) return;

  const jobStatus = context.jobStatus || "failed";

  if (jobStatus === "success") {
    console.log(`Slack notification skipped (status: ${jobStatus})`);
    return;
  }

  const branchName = (process.env.GITHUB_REF || "").replace("refs/heads/", "");
  if (branchName !== "main" && process.env.GITHUB_ACTIONS) {
    console.log(`Slack notification skipped (branch: ${branchName})`);
    return;
  }

  if (lines && shouldFilterOutTest(new Set(lines))) {
    return;
  }

  if (lines && lines.length > 0) {
    const failLines = extractFailLines(new Set(lines));
    if (failLines.length > 0) {
      context.failLines = failLines.length;
    }
  }

  const repository = process.env.GITHUB_REPOSITORY || "Unknown Repository";
  const workflowName = process.env.GITHUB_WORKFLOW || "Unknown Workflow";
  const environment = process.env.ENVIRONMENT || process.env.XMTP_ENV;
  const region = process.env.GEOLOCATION || "Unknown Region";
  const channel = context.channel || "general";

  const logPayload = {
    message: lines.join("\n"),
    failLines: context.failLines,
    level: "error",
    service: "xmtp-qa-tools",
    source: "xmtp-qa-tools",
    channel,
    repository,
    workflowName,
    environment,
    region,
    ...context,
  };

  try {
    await fetch("https://http-intake.logs.datadoghq.com/v1/input", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
      },
      body: JSON.stringify(logPayload),
    });
  } catch (err) {
    console.error("Failed to send log to Datadog:", err);
  }
}
