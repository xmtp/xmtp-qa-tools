import { exec } from "child_process";
import { promisify } from "util";
import type { WorkerManager } from "@workers/manager";
import metrics from "datadog-metrics";

// Global state variables
let isInitialized = false;
let currentGeo: string = "";

// Refactored thresholds into a single configuration object
const THRESHOLDS = {
  core: {
    clientcreate: 3000,
    createdm: 500,
    sendgm: 200,
    receivegm: 200,
    receivegroupmessage: 200,
    updategroupname: 200,
    syncgroup: 200,
    addmembers: 500,
    removemembers: 300,
    inboxstate: 100,
  },
  network: {
    processing: 100,
    tls_handshake: 200,
    server_call: 300,
    total_time: 300,
    dns_lookup: 100,
    tcp_connection: 100,
  },
  group: {
    createGroup: {
      "50": 2000,
      "100": 2000,
      "150": 4000,
      "200": 5000,
      "250": 7000,
      "300": 9000,
      "350": 11000,
      "400": 15000,
    },
    createGroupByIdentifiers: {
      "50": 2300,
      "100": 2500,
      "150": 3000,
      "200": 3500,
      "250": 4000,
      "300": 4500,
      "350": 5000,
      "400": 15000,
    },
    sendGroupMessage: {
      "50": 100,
      "100": 100,
      "150": 100,
      "200": 150,
      "250": 200,
      "300": 300,
      "350": 350,
      "400": 500,
    },
    syncGroup: {
      "50": 100,
      "100": 100,
      "150": 100,
      "200": 150,
      "250": 200,
      "300": 350,
      "350": 350,
      "400": 500,
    },
    updateGroupName: {
      "50": 100,
      "100": 100,
      "150": 150,
      "200": 200,
      "250": 200,
      "300": 300,
      "350": 350,
      "400": 500,
    },
    removeMembers: {
      "50": 150,
      "100": 200,
      "150": 200,
      "200": 250,
      "250": 300,
      "300": 350,
      "350": 400,
      "400": 550,
    },
  },
  regionMultipliers: {
    "us-east": 1.0,
    "us-west": 1.0,
    europe: 1.0,
    asia: 1.5,
    "south-america": 2.6,
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
  if (operationType === "network") {
    const networkThreshold =
      THRESHOLDS.network[
        operation.toLowerCase() as keyof typeof THRESHOLDS.network
      ];
    return typeof networkThreshold === "number" ? networkThreshold : 200;
  }

  if (operationType === "group") {
    const size = members || "50";

    // Get the operation-specific thresholds object
    const groupThresholds =
      THRESHOLDS.group[operation as keyof typeof THRESHOLDS.group];

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

  const coreOp = operation.toLowerCase();
  const baseThreshold =
    coreOp in THRESHOLDS.core
      ? THRESHOLDS.core[coreOp as keyof typeof THRESHOLDS.core]
      : 300;

  return Math.round(
    baseThreshold *
      (THRESHOLDS.regionMultipliers[
        region as keyof typeof THRESHOLDS.regionMultipliers
      ] || 1.0),
  );
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

// Combined metric sending function to reduce duplication
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

    if (allTags.includes("success:false")) {
      console.debug(fullMetricName, Math.round(metricValue), allTags);
    }
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

    const operationType = operationName.toLowerCase().includes("group")
      ? "group"
      : "core";
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
      const networkStats = await getNetworkStats();
      const countryCode = getCountryCodeFromGeo(currentGeo);

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const networkMetricValue = Math.round(statValue * 1000);
        const networkPhase = statName.toLowerCase().replace(/\s+/g, "_");
        const networkThreshold = getThresholdForOperation(
          networkPhase,
          "network",
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
 * Explicitly flush all buffered metrics to DataDog
 * Call this at the end of your test suite
 */
export function flushMetrics(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!isInitialized) {
      resolve();
      return;
    }

    //console.log("🔄 Flushing DataDog metrics...");

    void metrics.flush().then(() => {
      //console.log("✅ DataDog metrics flushed successfully");
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
  "Server Call": number;
  Processing: number;
}

export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}, \\"Total Time\\": %{time_total}}" -o /dev/null --max-time 10 ${endpoint}`;

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
  const stats = JSON.parse(stdout.trim()) as NetworkStats & {
    "Total Time": number;
  };

  // Handle the case where Server Call time is 0
  if (stats["Server Call"] === 0) {
    console.warn(
      `Network request to ${endpoint} returned Server Call time of 0. Total time: ${stats["Total Time"]}s`,
    );

    // Use Total Time as a fallback if it's available and non-zero
    if (stats["Total Time"] && stats["Total Time"] > stats["TLS Handshake"]) {
      stats["Server Call"] = stats["Total Time"];
    } else {
      // Otherwise use a reasonable estimate
      stats["Server Call"] = stats["TLS Handshake"] + 0.1;
    }
  }

  // Calculate processing time
  stats["Processing"] = stats["Server Call"] - stats["TLS Handshake"];

  // Ensure processing time is not negative
  if (stats["Processing"] < 0) {
    stats["Processing"] = 0;
  }

  if (
    stats["Processing"] * 1000 > 300 ||
    stats["TLS Handshake"] * 1000 > 300 ||
    stats["Server Call"] * 1000 > 300
  ) {
    if (!firstLogShared) {
      firstLogShared = true;
      console.warn(
        `Slow connection detected - total: ${stats["Server Call"] * 1000}ms, TLS: ${stats["TLS Handshake"] * 1000}ms, processing: ${stats["Processing"] * 1000}ms`,
      );
    }
  }

  return stats as NetworkStats;
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
