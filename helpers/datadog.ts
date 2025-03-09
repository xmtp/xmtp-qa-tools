import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";

let isInitialized = false;

export function initDataDog(
  testName: string,
  envValue: string,
  geolocation: string,
  apiKey: string,
): boolean {
  // Check if already initialized
  if (isInitialized) {
    return true;
  }
  if (!testName.includes("ts_")) {
    return true;
  }

  // Verify API key is available
  if (!apiKey) {
    console.warn("⚠️ DATADOG_API_KEY not found. Metrics will not be sent.");
    return false;
  }

  try {
    const initConfig = {
      apiKey: apiKey,
      defaultTags: [
        `env:${envValue}`,
        `test:${testName}`,
        `geo:${geolocation}`,
      ],
    };
    metrics.init(initConfig);

    console.log(
      `✅ DataDog metrics initialized successfully ${JSON.stringify(initConfig)}`,
    );
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize DataDog metrics:", error);
    return false;
  }
}

// Add this new function to send message delivery metrics
export function sendDeliveryMetric(
  metricValue: number,
  testName: string,
  libxmtpVersion: string,
  metricType: string = "stream",
  metricName: string = "delivery",
): void {
  if (!isInitialized) {
    return;
  }

  try {
    const members = testName.split("-")[1] || "";

    // Send delivery rate metric
    console.log(
      `Sending metric: xmtp.sdk.${metricName} with value ${metricValue}`,
    );
    metrics.gauge(`xmtp.sdk.${metricName}`, metricValue, [
      `libxmtp:${libxmtpVersion}`,
      `test:${testName}`,
      `metric_type:${metricType}`,
      `members:${members}`,
    ]);
  } catch (error) {
    console.error("❌ Error sending message delivery metrics:", error);
  }
}

export async function sendRailwayEvent(
  status: "success" | "failure",
  testName: string,
): Promise<void> {
  const datadog_api_key = process.env.DATADOG_API_KEY;

  if (!datadog_api_key) {
    console.error("WARNING: Datadog API key is not available");
    return;
  }

  const alertType = status === "success" ? "success" : "error";
  const title = `Railway Test ${testName} ${status === "success" ? "Succeeded" : "Failed"}`;
  const text = `Railway test ${testName} ${status === "success" ? "completed successfully" : "failed"} in ${process.env.XMTP_ENV || "unknown"} environment`;

  try {
    // Send event to Datadog
    await fetch("https://api.datadoghq.com/api/v1/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": datadog_api_key,
      },
      body: JSON.stringify({
        title,
        text: `${text}\n\nTrigger: Railway`,
        alert_type: alertType,
        source_type_name: "railway",
        tags: [
          `test:${testName}`,
          `environment:${process.env.XMTP_ENV || "unknown"}`,
          `status:${status}`,
        ],
      }),
    });

    // Send metric to Datadog
    const metricValue = status === "success" ? 1 : 0;

    await fetch("https://api.datadoghq.com/api/v1/series", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": datadog_api_key,
      },
      body: JSON.stringify({
        series: [
          {
            metric: "railway.test.status",
            type: "gauge",
            points: [[Math.floor(Date.now() / 1000), metricValue]],
            tags: [
              `test:${testName}`,
              `environment:${process.env.XMTP_ENV || "unknown"}`,
            ],
          },
        ],
      }),
    });

    console.log(`Successfully reported ${status} to Datadog`);
  } catch (error) {
    console.error("Error reporting to Datadog:", error);
  }
}

export async function sendPerformanceMetric(
  metricValue: number,
  testName: string,
  libxmtpVersion: string,
  skipNetworkStats: boolean = false,
): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    const metricNameParts = testName.split(":")[0];
    const metricName = metricNameParts.replaceAll(" > ", ".");
    const metricDescription = testName.split(":")[1];
    // Extract operation name for tagging
    const operationParts = metricName.split(".");
    const operationName = operationParts[1];
    const testNameExtracted = operationParts[0];
    const members = testNameExtracted.split("-")[1] || "";
    const durationMetricName = `xmtp.sdk.duration`;

    // Send main operation metric
    metrics.gauge(durationMetricName, metricValue, [
      `libxmtp:${libxmtpVersion}`,
      `operation:${operationName}`,
      `test:${testNameExtracted}`,
      `metric_type:operation`,
      `description:${metricDescription}`,
      `members:${members}`,
    ]);

    // Handle network stats if needed
    if (!skipNetworkStats) {
      const networkStats = await getNetworkStats();

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const metricValue = statValue * 1000; // Convert to milliseconds
        metrics.gauge(durationMetricName, metricValue, [
          `libxmtp:${libxmtpVersion}`,
          `operation:${operationName}`,
          `test:${testName}`,
          `metric_type:network`,
          `network_phase:${statName.toLowerCase().replace(/\s+/g, "_")}`,
        ]);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending metric '${testName}':`, error);
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

interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  "Server Call": number;
  Processing: number;
}

/**
 * Get network performance statistics for a specific endpoint
 * @param endpoint The endpoint to monitor (defaults to XMTP gRPC endpoint)
 * @returns Object containing timing information in seconds
 */
let firstLogShared = false;
export async function getNetworkStats(
  endpoint = "https://grpc.dev.xmtp.network:443",
): Promise<NetworkStats> {
  try {
    // Construct the curl command with timing parameters
    const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Call\\": %{time_starttransfer}}" -o /dev/null ${endpoint}`;

    // Execute the curl command
    const { stdout } = await execAsync(curlCommand);

    // Parse the JSON response
    const stats = JSON.parse(stdout.trim()) as NetworkStats;

    // Optional: Log warnings for slow connections
    stats["Processing"] = stats["Server Call"] - stats["TLS Handshake"];

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

    return stats;
  } catch (error) {
    console.error("Failed to get network stats:", error);
    // Return zeroed stats on error
    return {
      "DNS Lookup": 0,
      "TCP Connection": 0,
      "TLS Handshake": 0,
      "Server Call": 0,
      Processing: 0,
    };
  }
}
