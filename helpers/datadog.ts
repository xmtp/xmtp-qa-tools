import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";
import fetch from "node-fetch";

interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  Processing: number;
  "Server Call": number;
}

interface MetricData {
  values: number[];
  members?: string;
}

interface ParsedTestName {
  metricName: string;
  metricDescription: string;
  testNameExtracted: string;
  operationType: string;
  operationName: string;
  members: string;
}

const GEO_TO_COUNTRY_CODE = {
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

/**
 * Send a metric to DataDog and collect for summary
 */
export function sendMetric(
  metricName: string,
  metricValue: number,
  tags: Record<string, string>,
): void {
  if (!state.isInitialized) return;

  try {
    const fullMetricName = `xmtp.sdk.${metricName}`;
    const allTags = Object.entries({ ...tags }).map(
      ([key, value]) => `${key}:${String(value)}`,
    );

    // Add environment tag if not already present
    if (!allTags.some((tag) => tag.startsWith("env:"))) {
      allTags.push(`env:${process.env.XMTP_ENV as string}`);
    }
    // Add region tag if not already present
    if (!allTags.some((tag) => tag.startsWith("region:"))) {
      allTags.push(`region:${process.env.GEOLOCATION as string}`);
    }

    // Create a distinctive operation key that properly includes member count
    // Format: operation_name-member_count (e.g., "createGroup-10")
    const memberCount = tags.members || "";
    const operationKey = tags.operation
      ? `${tags.operation}${memberCount ? `-${memberCount}` : ""}`
      : metricName;

    if (!state.collectedMetrics[operationKey]) {
      state.collectedMetrics[operationKey] = {
        values: [],
        members: memberCount,
      };
    }

    state.collectedMetrics[operationKey].values.push(metricValue);

    if (tags.metric_type !== "network") {
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

    metrics.gauge(fullMetricName, Math.round(metricValue), allTags);
  } catch (error) {
    console.error(
      `❌ Error sending metric '${metricName}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
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

/**
 * Send detailed performance metrics
 */
export async function sendPerformanceMetric(
  metricValue: number,
  testName: string,
  skipNetworkStats: boolean = false,
): Promise<void> {
  if (!state.isInitialized) return;
  const libXmtpVersion = "latest";
  try {
    const {
      metricDescription,
      testNameExtracted,
      operationType,
      operationName,
      members,
    } = parseTestName(testName);

    const values = {
      libxmtp: libXmtpVersion,
      operation: operationName,
      test: testNameExtracted,
      metric_type: "operation",
      metric_subtype: operationType,
      description: metricDescription,
      members: members,
      region: process.env.GEOLOCATION ?? "",
    };
    if (testName.includes("m_")) {
      sendMetric("duration", metricValue, values);
    }

    // Network stats handling
    if (!skipNetworkStats && testName.includes("m_performance")) {
      const networkStats = await getNetworkStats();
      const countryCode =
        GEO_TO_COUNTRY_CODE[
          process.env.GEOLOCATION as keyof typeof GEO_TO_COUNTRY_CODE
        ];

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const networkMetricValue = Math.round(statValue * 1000);
        const networkPhase = statName.toLowerCase().replace(/\s+/g, "_");

        sendMetric("duration", networkMetricValue, {
          libxmtp: libXmtpVersion,
          operation: operationName,
          test: testNameExtracted,
          metric_type: "network",
          network_phase: networkPhase,
          country_iso_code: countryCode,
          members: members,
          region: process.env.GEOLOCATION ?? "",
        });
      }
    }
  } catch (error) {
    console.error(
      `❌ Error sending performance metric for '${testName}':`,
      error,
    );
  }
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
    // Even if curl returns an error, we might still have useful stdout
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

  // Parse the JSON response
  const stats = JSON.parse(stdout.trim()) as NetworkStats;

  // Handle the case where Server Call time is 0
  if (stats["Server Call"] === 0) {
    console.warn(
      `Network request to ${endpoint} returned Server Call time of 0.`,
    );

    // Use a reasonable estimate
    stats["Server Call"] = stats["TLS Handshake"] + 0.1;
  }

  // Calculate processing time
  stats["Processing"] = stats["Server Call"] - stats["TLS Handshake"];

  // Ensure processing time is not negative
  if (stats["Processing"] < 0) {
    stats["Processing"] = 0;
  }

  return stats;
}

// Reporting and summary
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
  const logPayload = {
    message: lines.join("\n"),
    level: "error",
    service: "xmtp-qa-tools",
    source: "xmtp-qa-tools",
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
