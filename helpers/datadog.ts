import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";
import dotenv from "dotenv";
import type { Persona } from "./types";

dotenv.config();

let isInitialized = false;

export function initDataDog(testName: string): boolean {
  // Check if already initialized
  if (isInitialized) {
    return true;
  }

  // Verify API key is available
  if (!process.env.DATADOG_API_KEY) {
    console.warn("⚠️ DATADOG_API_KEY not found. Metrics will not be sent.");
    console.warn("→ Create a .env file with your DATADOG_API_KEY=xxx");
    return false;
  }

  try {
    const envValue = process.env.XMTP_ENV;
    const geolocation = process.env.GEOLOCATION;
    const initConfig = {
      prefix: `xmtp.sdk.`,
      apiKey: process.env.DATADOG_API_KEY,
      defaultTags: [
        `qa_env:${envValue}`,
        `qa_test:${testName}`,
        `qa_geo:${geolocation}`,
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
    let metricName = (key.match(/^([^:]+):/) || [null, key])[1].replaceAll(
      " > ",
      ".",
    );
    if (metricName.includes("ts_")) {
      metricName = metricName.replace(
        "ts_performance.ts_performance.",
        "ts_performance.",
      );
      metricName = metricName.replaceAll(".dms.", ".");
    }

    // Extract operation name for tagging - ensure consistent naming
    const operationParts = metricName.split(".");
    const operationName =
      operationParts[operationParts.length - 1] || "unknown";

    // Ensure consistent metric naming format
    if (!metricName.startsWith("xmtp.sdk.ts_performance.")) {
      metricName = `xmtp.sdk.ts_performance.${operationName}`;
    }

    // console.log(
    //   `Sending metric: ${metricName} with value: ${value} and operation: ${operationName}`,
    // );

    metrics.gauge(metricName, value, [
      `qa_libxmtp:${firstPersona.version}`,
      `qa_operation:${operationName}`,
    ]);

    if (!skipNetworkStats && !metricName.includes(".network.")) {
      const networkStats = await reportNetworkStats(metricName);
      Object.entries(networkStats).forEach(([stat, value]) => {
        metrics.gauge(stat, value, [
          `qa_libxmtp:${firstPersona.version}`,
          `qa_operation:${operationName}`, // Use same normalized name for network stats
        ]);
      });
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
  "Server Processing": number;
  "Content Transfer": number;
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
    const curlCommand = `curl -s -w "\\n{\\"DNS Lookup\\": %{time_namelookup}, \\"TCP Connection\\": %{time_connect}, \\"TLS Handshake\\": %{time_appconnect}, \\"Server Processing\\": %{time_starttransfer}, \\"Content Transfer\\": %{time_total}}\\n" -o /dev/null ${endpoint}`;

    // Execute the curl command
    const { stdout } = await execAsync(curlCommand);

    // Parse the JSON response
    const stats = JSON.parse(stdout.trim()) as NetworkStats;

    // Optional: Log warnings for slow connections
    const tlsTimeInMs = stats["TLS Handshake"] * 1000;
    const totalTransferTimeInMs = stats["Content Transfer"] * 1000;
    const processingTimeInMs = totalTransferTimeInMs - tlsTimeInMs;

    if (
      processingTimeInMs > 300 ||
      tlsTimeInMs > 300 ||
      totalTransferTimeInMs > 300
    ) {
      // console.warn(
      //   `Slow connection detected - total: ${totalTransferTimeInMs.toFixed(2)}ms, TLS: ${tlsTimeInMs.toFixed(2)}ms, processing: ${processingTimeInMs.toFixed(2)}ms`,
      // );
    }

    return stats;
  } catch (error) {
    console.error("Failed to get network stats:", error);
    // Return zeroed stats on error
    return {
      "DNS Lookup": 0,
      "TCP Connection": 0,
      "TLS Handshake": 0,
      "Server Processing": 0,
      "Content Transfer": 0,
    };
  }
}

/**
 * Get network stats and send them as metrics
 * @param operation Operation name for the metrics
 * @param endpoint Optional endpoint to monitor
 * @param env Optional environment override for this specific metric
 * @param geolocation Optional geolocation for this specific metric
 */
export async function reportNetworkStats(
  operation: string,
  endpoint?: string,
): Promise<Record<string, number>> {
  const returnValue: Record<string, number> = {};
  const networkStats = await getNetworkStats(endpoint);
  for (const [key, value] of Object.entries(networkStats)) {
    const metricValue = value * 1000;
    const metricKey = `${operation}.network.${key.toLowerCase().replace(/\s+/g, "_")}`;
    returnValue[metricKey] = metricValue;
  }
  return returnValue;
}
