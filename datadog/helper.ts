import type { WorkerManager } from "@workers/manager";
import metrics from "datadog-metrics";
import { getThresholdForOperation } from "./calculations";
import { getNetworkStats } from "./network";
import { logMetricsSummary } from "./summary";
import THRESHOLDS from "./thresholds.json";

// Global state variables
let isInitialized = false;
let currentGeo: string = "";
let collectedMetrics: Record<
  string,
  { values: number[]; threshold: number; members?: string }
> = {};

function getCountryCodeFromGeo(geolocation: string): string {
  return (
    THRESHOLDS.GEO_TO_COUNTRY_CODE[
      geolocation as keyof typeof THRESHOLDS.GEO_TO_COUNTRY_CODE
    ] || "US"
  );
}

export const sendPerformanceResult = (
  expect: any,
  workers: WorkerManager,
  start: number,
  batchSize?: number,
  total?: number,
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
      false,
      batchSize ?? undefined,
      total ?? undefined,
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
    console.log(
      `SENDING METRIC: ${metricName}, Value: ${metricValue}, Members: ${tags.members || "none"}`,
    );

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

    // Create a distinctive operation key that properly includes member count
    // Format: operation_name-member_count (e.g., "createGroup-10")
    const memberCount = tags.members || "";
    const operationKey = tags.operation
      ? `${tags.operation}${memberCount ? `-${memberCount}` : ""}`
      : metricName;

    // For debugging
    console.log(
      `METRIC KEY: ${operationKey} (Operation: ${tags.operation}, Members: ${memberCount})`,
    );

    if (!collectedMetrics[operationKey]) {
      collectedMetrics[operationKey] = {
        values: [],
        threshold: tags.threshold || 0,
        members: memberCount,
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
  batchSize?: number,
  total?: number,
): Promise<void> {
  if (!isInitialized) return;

  try {
    const metricNameParts = testName.split(":")[0];
    const metricName = metricNameParts.replaceAll(" > ", ".");
    const metricDescription = testName.split(":")[1] || "";
    const operationParts = metricName.split(".");
    const testNameExtracted = operationParts[0];

    // Extract operation name and member count more reliably
    let operationName = "";
    let members = "";

    if (operationParts[1]) {
      // Check for both formats: "operation-10" and "operation10"
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

    // Debug output
    console.log(
      `Extracted from test name: Operation=${operationName}, Members=${members}, Test=${testNameExtracted}`,
    );

    const isGroupOperation = operationName.toLowerCase().includes("-");
    const operationType = isGroupOperation ? "group" : "core";

    // Use the extracted member count for threshold calculation
    const memberCount = members ? parseInt(members) : total;
    const threshold = getThresholdForOperation(
      operationName,
      operationType,
      members,
      currentGeo,
      batchSize ?? undefined,
      memberCount, // Pass the actual member count here
    );

    const isSuccess = metricValue <= threshold;

    console.log(`Operation metrics:`, {
      operation: operationName,
      members: members,
      testName: testName,
    });

    console.log(`Running test with ${memberCount} members`);

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
          batchSize,
          total,
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

// Modify flushMetrics to include the summary log
export function flushMetrics(
  testName: string,
  batchSize?: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!isInitialized) {
      resolve();
      return;
    }

    logMetricsSummary(
      testName,
      currentGeo,
      isInitialized,
      collectedMetrics,
      batchSize ?? undefined,
    );

    void metrics.flush().then(() => {
      resolve();
    });
  });
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
