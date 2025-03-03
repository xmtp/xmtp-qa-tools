import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";
import type { Persona } from "./types";

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
  if (testName.includes("bug")) {
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
    console.log(`initConfig: ${JSON.stringify(initConfig)}`);
    metrics.init(initConfig);

    console.log("✅ DataDog metrics initialized successfully");
    isInitialized = true;
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize DataDog metrics:", error);
    return false;
  }
}
export async function sendMetric(
  value: number,
  key: string,
  personas: Record<string, Persona>,
  skipNetworkStats: boolean = false,
): Promise<void> {
  if (!isInitialized) {
    console.warn(
      `⚠️ DataDog not initialized. Metric '${key}' will not be sent.`,
    );
    return;
  }

  try {
    const firstPersona = Object.values(personas)[0];
    const metricName = (key.match(/^([^:]+):/) || [null, key])[1].replaceAll(
      " > ",
      ".",
    );

    // Extract operation name for tagging
    const operationParts = metricName.split(".");
    const operationName = operationParts[1];
    const testName = operationParts[0];
    const durationMetricName = `xmtp.sdk.duration`;
    console.log(`Operation name: ${operationName}`);
    console.log(`Test name: ${testName}`);
    console.log(`Duration metric name: ${durationMetricName}`);

    // Send main operation metric
    metrics.gauge(durationMetricName, value, [
      `libxmtp:${firstPersona.version}`,
      `operation:${operationName}`,
      `test:${testName}`,
      `metric_type:operation`,
    ]);

    // Handle network stats if needed
    if (!skipNetworkStats) {
      const networkStats = await getNetworkStats();

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const metricValue = statValue * 1000; // Convert to milliseconds
        metrics.gauge(durationMetricName, metricValue, [
          `libxmtp:${firstPersona.version}`,
          `operation:${operationName}`,
          `test:${testName}`,
          `metric_type:network`,
          `network_phase:${statName.toLowerCase().replace(/\s+/g, "_")}`,
        ]);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending metric '${key}':`, error);
  }
}

/**
 * Explicitly flush all buffered metrics to DataDog
 * Call this at the end of your test suite
 */
export function flushMetrics(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!isInitialized) {
      console.warn("⚠️ DataDog not initialized. No metrics to flush.");
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
      console.warn(
        `Slow connection detected - total: ${stats["Server Call"] * 1000}ms, TLS: ${stats["TLS Handshake"] * 1000}ms, processing: ${stats["Processing"] * 1000}ms`,
      );
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
