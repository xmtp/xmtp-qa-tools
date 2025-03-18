import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import type { WorkerManager } from "@workers/manager";
import metrics from "datadog-metrics";

// Global state variables
let isInitialized = false;
let currentGeo: string = "";
let collectedMetrics: Record<
  string,
  { values: number[]; threshold: number; members?: string }
> = {};

// Refactored thresholds into a single configuration object
const THRESHOLDS = {
  core: {
    clientcreate: 550,
    createdm: 200,
    sendgm: 100,
    receivegm: 100,
    creategroup: 2000,
    creategroupbyidentifiers: 2000,
    receivegroupmessage: 150,
    updategroupname: 100,
    syncgroup: 100,
    addmembers: 250,
    removemembers: 250,
    inboxstate: 50,
  },
  network: {
    dns_lookup: 175,
    tcp_connection: 175,
    tls_handshake: 175,
    processing: 175,
    server_call: 175,
  },
  group: {
    creategroup: {
      "50": 900,
      "100": 1600,
      "150": 2300,
      "200": 3500,
      "250": 5500,
      "300": 5500,
      "350": 8000,
      "400": 9000,
    },
    creategroupbyidentifiers: {
      "50": 600,
      "100": 1500,
      "150": 2600,
      "200": 3500,
      "250": 5500,
      "300": 6500,
      "350": 6500,
      "400": 7500,
    },
    sendgroupmessage: {
      "50": 650,
      "100": 1000,
      "150": 1600,
      "200": 2500,
      "250": 3500,
      "300": 4500,
      "350": 5000,
      "400": 6000,
    },
    syncgroup: {
      "50": 100,
      "100": 100,
      "150": 100,
      "200": 100,
      "250": 100,
      "300": 100,
      "350": 100,
      "400": 100,
    },
    updategroupname: {
      "50": 100,
      "100": 80,
      "150": 100,
      "200": 100,
      "250": 100,
      "300": 100,
      "350": 100,
      "400": 100,
    },
    removemembers: {
      "50": 100,
      "100": 100,
      "150": 120,
      "200": 150,
      "250": 175,
      "300": 200,
      "350": 225,
      "400": 250,
    },
  },
  regionMultipliers: {
    "us-east": 1.0,
    "us-west": 1.0,
    europe: 1.0,
    asia: 1.5,
    "south-america": 2,
  },
  GEO_TO_COUNTRY_CODE: {
    "us-east": "US",
    "us-west": "US",
    europe: "FR",
    asia: "JP",
    "south-america": "BR",
  },
  reliability: 99.9,
};

function getCountryCodeFromGeo(geolocation: string): string {
  return (
    THRESHOLDS.GEO_TO_COUNTRY_CODE[
      geolocation as keyof typeof THRESHOLDS.GEO_TO_COUNTRY_CODE
    ] || "US"
  );
}

// Simplified threshold function
export function getThresholdForOperation(
  operation: string,
  operationType: string = "core",
  members: string = "",
  region: string = "us-east",
): number {
  // Convert operation to lowercase for consistent lookups
  const operationLower = operation.toLowerCase();

  // Get the region multiplier
  const regionMultiplier =
    THRESHOLDS.regionMultipliers[
      region as keyof typeof THRESHOLDS.regionMultipliers
    ] || 1.0;

  if (operationType === "network") {
    const networkThreshold =
      THRESHOLDS.network[operationLower as keyof typeof THRESHOLDS.network];
    // Default to 200 if the specific network operation isn't found
    const baseThreshold =
      typeof networkThreshold === "number" ? networkThreshold : 200;

    // Apply region multiplier to network thresholds
    const finalThreshold = Math.round(baseThreshold * regionMultiplier);

    return finalThreshold;
  }

  if (operationType === "group") {
    const size = members || "50";

    // Get the operation-specific thresholds object
    const groupThresholds =
      THRESHOLDS.group[operationLower as keyof typeof THRESHOLDS.group];

    // Safely check if this size exists, defaulting to 2000 if not
    let baseThreshold = 2000;
    if (groupThresholds) {
      // Use type assertion to tell TypeScript this is a valid lookup
      const sizeKey = size as unknown as keyof typeof groupThresholds;
      if (sizeKey in groupThresholds) {
        baseThreshold = groupThresholds[sizeKey];
      }
    }

    return Math.round(
      baseThreshold *
        (THRESHOLDS.regionMultipliers[
          region as keyof typeof THRESHOLDS.regionMultipliers
        ] || 1.0),
    );
  }

  // For core operations, ensure we're using lowercase for lookup
  const baseThreshold =
    operationLower in THRESHOLDS.core
      ? THRESHOLDS.core[operationLower as keyof typeof THRESHOLDS.core]
      : 300;

  const finalThreshold = Math.round(baseThreshold * regionMultiplier);

  return finalThreshold;
}

export const sendPerformanceResult = (
  expect: any,
  workers: WorkerManager,
  start: number,
) => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    console.timeEnd(testName as string);
    expect(workers.getWorkers()).toBeDefined();
    expect(workers.getWorkers().length).toBeGreaterThan(0);
    void sendPerformanceMetric(
      performance.now() - start,
      testName as string,
      workers.getVersion(),
    );
  }
};
// Add success status tag to duration metrics

export function initDataDog(
  testName: string,
  envValue: string,
  geolocation: string,
  apiKey: string,
): boolean {
  if (isInitialized) {
    return true;
  }
  if (!testName.includes("ts_")) {
    return true;
  }
  if (!apiKey) {
    console.warn("⚠️ DATADOG_API_KEY not found. Metrics will not be sent.");
    return false;
  }

  try {
    const countryCode = getCountryCodeFromGeo(geolocation);
    currentGeo = geolocation;
    const initConfig = {
      apiKey: apiKey,
      defaultTags: [
        `env:${envValue}`,
        `test:${testName}`,
        `region:${geolocation}`,
        `country_iso_code:${countryCode}`,
      ],
    };
    metrics.init(initConfig);
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize DataDog metrics:", error);
    return false;
  }
}

// Modify the sendMetric function to collect metrics for summary
export function sendMetric(
  metricName: string,
  metricValue: number,
  tags: Record<string, any>,
): void {
  if (!isInitialized) return;

  try {
    const fullMetricName = `xmtp.sdk.${metricName}`;
    const allTags = Object.entries({ ...tags }).map(
      ([key, value]) => `${key}:${String(value)}`,
    );
    // Add environment tag if not already present
    if (!allTags.some((tag) => tag.startsWith("env:"))) {
      allTags.push(`env:${process.env.XMTP_ENV as string}`);
    }
    // Add version tag if not already present
    if (!allTags.some((tag) => tag.startsWith("xv:"))) {
      allTags.push(`vm:${process.env.RAILWAY_SERVICE_ID || "unknown"}`);
    }

    // Track metrics for summary log
    // Include members in the operation key if available
    const operationKey = tags.operation
      ? `${tags.operation}:${tags.metric_type || ""}${tags.members ? `:${tags.members}` : ""}`
      : metricName;

    if (!collectedMetrics[operationKey]) {
      collectedMetrics[operationKey] = {
        values: [],
        threshold: tags.threshold || 0,
        members: tags.members || "-", // Store members info separately
      };
    }
    collectedMetrics[operationKey].values.push(metricValue);

    metrics.gauge(fullMetricName, Math.round(metricValue), allTags);
  } catch (error) {
    console.error(
      `❌ Error sending metric '${metricName}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function sendTestResults(hasFailures: boolean, testName: string): void {
  if (!isInitialized) {
    console.warn("Datadog metrics not initialized");
    return;
  }
  try {
    const metricValue = hasFailures ? 0 : 1;
    const metricName = `workflow`;
    sendMetric(metricName, metricValue, {
      workflow: testName,
      metric_type: "workflow",
    });
    console.log(
      `The tests indicated that the test ${testName} was ${hasFailures}`,
    );
  } catch (error) {
    console.error("Error reporting to Datadog:", error);
  }
}

// Simplified version of sendPerformanceMetric
export async function sendPerformanceMetric(
  metricValue: number,
  testName: string,
  libxmtpVersion: string,
  skipNetworkStats: boolean = false,
): Promise<void> {
  if (!isInitialized) return;

  try {
    const metricNameParts = testName.split(":")[0];
    const metricName = metricNameParts.replaceAll(" > ", ".");
    const metricDescription = testName.split(":")[1] || "";
    const operationParts = metricName.split(".");
    const testNameExtracted = operationParts[0];
    const operationName = operationParts[1]?.split("-")[0] || "";
    const members = operationParts[1]?.split("-")[1] || "";

    // Use a more reliable approach to determine if this is a group operation
    const isGroupOperation = operationName.toLowerCase().includes("group");
    const operationType = isGroupOperation ? "group" : "core";

    const threshold = getThresholdForOperation(
      operationName,
      operationType,
      members,
      currentGeo,
    );
    const isSuccess = metricValue <= threshold;

    sendMetric("duration", metricValue, {
      libxmtp: libxmtpVersion,
      operation: operationName,
      test: testNameExtracted,
      metric_type: "operation",
      metric_subtype: operationType,
      description: metricDescription,
      members: members,
      success: isSuccess,
      threshold: threshold,
      region: currentGeo,
    });

    // Network stats handling
    if (!skipNetworkStats) {
      //ignore group operations
      const networkStats = await getNetworkStats();
      const countryCode = getCountryCodeFromGeo(currentGeo);

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const networkMetricValue = Math.round(statValue * 1000);
        const networkPhase = statName.toLowerCase().replace(/\s+/g, "_");
        const networkThreshold = getThresholdForOperation(
          networkPhase,
          "network",
          members,
          currentGeo,
        );

        sendMetric("duration", networkMetricValue, {
          libxmtp: libxmtpVersion,
          operation: operationName,
          test: testNameExtracted,
          metric_type: "network",
          network_phase: networkPhase,
          country_iso_code: countryCode,
          members: members,
          success: networkMetricValue <= networkThreshold,
          threshold: networkThreshold,
          region: currentGeo,
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

/**
 * Logs a summary of all collected metrics against their thresholds
 * Call this at the end of test execution
 */
export function logMetricsSummary(testName: string): void {
  if (!isInitialized || Object.keys(collectedMetrics).length === 0) {
    console.log("No metrics collected to summarize");
    return;
  }

  console.log("\n📊 Creating metrics summary report");

  // Create a simple text summary for the console
  const passedMetrics = Object.entries(collectedMetrics).filter(
    ([operation, data]) => {
      // Skip workflow metrics when counting passed metrics
      if (operation === "workflow") return false;

      if (data.values.length === 0) return false;
      const average =
        data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
      return average <= data.threshold;
    },
  ).length;

  // Count only non-workflow metrics for total
  const totalMetrics = Object.entries(collectedMetrics).filter(
    ([operation]) => operation !== "workflow",
  ).length;

  console.log(
    `✅ Passed: ${passedMetrics}/${totalMetrics} metrics (${Math.round((passedMetrics / totalMetrics) * 100)}%)`,
  );

  // Create a directory for reports if it doesn't exist
  const reportsDir = path.join(process.cwd(), "logs/reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(
    reportsDir,
    `${testName}-${currentGeo}-${process.env.XMTP_ENV}.md`,
  );

  // Build the table content
  let fileContent = "METRICS SUMMARY\n===============\n\n";
  fileContent +=
    "Operation | Members | Samples | Avg (ms) | Min/Max (ms) | Threshold (ms) | Variance (ms) | Pass Rate | Status\n";
  fileContent +=
    "----------|---------|---------|----------|--------------|----------------|---------------|-----------|-------\n";

  for (const [operation, data] of Object.entries(collectedMetrics)) {
    // Skip workflow metrics in the summary table
    if (operation === "workflow") continue;

    if (data.values.length === 0) continue;

    // Extract member count from operationKey
    const parts = operation.split(":");
    // The member count should be the last segment if it exists
    const memberCount =
      parts.length > 2 ? parts[parts.length - 1] : data.members || "-";

    const average =
      data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
    const min = Math.min(...data.values);
    const max = Math.max(...data.values);
    const passRate =
      (data.values.filter((v) => v <= data.threshold).length /
        data.values.length) *
      100;
    const status = average <= data.threshold ? "PASS ✅" : "FAIL ❌";

    // Calculate variance between average and threshold
    const variance = Math.round(average - data.threshold);
    const varianceFormatted =
      variance <= 0 ? variance.toString() : `+${variance}`;

    fileContent += `${operation} | ${memberCount} | ${data.values.length} | ${Math.round(average)} | ${Math.round(min)}/${Math.round(max)} | ${data.threshold} | ${varianceFormatted} | ${passRate.toFixed(1)}% | ${status}\n`;
  }

  // Write to file
  try {
    fs.writeFileSync(filename, fileContent);
    console.log(`📝 Metrics summary written to: ${filename}`);
  } catch (error) {
    console.error(`❌ Error writing metrics summary to file:`, error);
  }

  // Reset metrics collection for next test run
  collectedMetrics = {};
}

// Modify flushMetrics to include the summary log
export function flushMetrics(testName: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!isInitialized) {
      resolve();
      return;
    }

    // Log metrics summary before flushing
    logMetricsSummary(testName);

    void metrics.flush().then(() => {
      resolve();
    });
  });
}

const execAsync = promisify(exec);

/**
 * Get network performance statistics for a specific endpoint
 * @param endpoint The endpoint to monitor (defaults to XMTP gRPC endpoint)
 * @returns Object containing timing information in seconds
 */
let firstLogShared = false;

interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  Processing: number;
  "Server Call": number;
}

export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}}" -o /dev/null --max-time 10 ${endpoint}`;

  let stdout: string;

  try {
    const result = await execAsync(curlCommand);
    stdout = result.stdout;
  } catch (error: any) {
    // Even if curl returns an error, we might still have useful stdout
    if (error.stdout) {
      stdout = error.stdout;
      console.warn(
        `⚠️ Curl command returned error code ${error.code}, but stdout is available.`,
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

// Unified delivery metrics function
export function sendDeliveryMetric(
  metricValue: number,
  version: string,
  testName: string,
  metricSubType: "stream" | "poll" | "recovery",
  metricType: "delivery" | "order",
): void {
  // Determine success based on the metric subtype
  const threshold = THRESHOLDS.reliability;

  const isSuccess = metricValue >= threshold;

  // Send primary metric
  sendMetric(metricType, Math.round(metricValue), {
    libxmtp: version,
    test: testName,
    metric_type: metricType,
    metric_subtype: metricSubType,
    success: isSuccess,
    threshold: threshold,
  });
}
