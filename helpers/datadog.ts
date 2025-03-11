import { exec } from "child_process";
import { promisify } from "util";
import metrics from "datadog-metrics";

let isInitialized = false;
let currentGeo = "";

// Add this mapping function
function getCountryCodeFromGeo(geolocation: string): string {
  // Map your geo regions to ISO country codes
  const geoToCountryCode: Record<string, string> = {
    "us-east": "US",
    "us-west": "US",
    europe: "FR", // Using France as a representative for Europe
    asia: "JP", // Using Japan as a representative for Asia
    "south-america": "BR", // Using Brazil as a representative for South America
  };

  return geoToCountryCode[geolocation] || "US"; // Default to US if not found
}

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
        `geo:${geolocation}`,
        `geo.country_iso_code:${countryCode}`,
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

    metrics.gauge(`xmtp.sdk.${metricName}`, Math.round(metricValue), [
      `libxmtp:${libxmtpVersion}`,
      `test:${testName}`,
      `metric_type:${metricType}`,
      `members:${members}`,
    ]);
  } catch (error) {
    console.error("❌ Error sending message delivery metrics:", error);
  }
}

export function sendTestResults(
  status: "success" | "failure",
  testName: string,
): void {
  if (!isInitialized) {
    console.error("WARNING: Datadog metrics not initialized");
    return;
  }

  console.log(`The tests indicated that the test ${testName} was ${status}`);

  try {
    // Send metric to Datadog using metrics.gauge
    const metricValue = status === "success" ? 1 : 0;
    const metricName = `xmtp.sdk.workflow.status`;
    console.debug({
      metricName,
      metricValue,
      status,
      workflow: testName,
    });
    metrics.gauge(metricName, metricValue, [
      `status:${status}`,
      `workflow:${testName}`,
    ]);

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
    const testNameExtracted = operationParts[0];
    const operationName = operationParts[1].split("-")[0];
    const members = operationParts[1].split("-")[1] || "";
    const durationMetricName = `xmtp.sdk.duration`;

    // // Send main operation metric
    // console.debug({
    //   durationMetricName,
    //   metricValue,
    //   libxmtpVersion,
    //   operationName,
    //   testNameExtracted,
    //   metricDescription,
    //   members,
    //   geo: currentGeo,
    //   countryCode: getCountryCodeFromGeo(currentGeo),
    // });
    metrics.gauge(durationMetricName, Math.round(metricValue), [
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

      const geo = currentGeo || "";
      const countryCode = getCountryCodeFromGeo(geo);

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const metricValue = Math.round(statValue * 1000); // Convert to milliseconds
        // Send main operation metric
        // console.debug({
        //   durationMetricName,
        //   metricValue,
        //   libxmtpVersion,
        //   operationName,
        //   testNameExtracted,
        //   metric_type: "network",
        //   network_phase: statName.toLowerCase().replace(/\s+/g, "_"),
        //   countryCode: getCountryCodeFromGeo(currentGeo),
        //   members,
        // });
        metrics.gauge(durationMetricName, metricValue, [
          `libxmtp:${libxmtpVersion}`,
          `operation:${operationName}`,
          `test:${testNameExtracted}`,
          `metric_type:network`,
          `network_phase:${statName.toLowerCase().replace(/\s+/g, "_")}`,
          `geo.country_iso_code:${countryCode}`,
          `members:${members}`,
        ]);
      }
    }
  } catch (error) {
    console.error(`❌ Error sending metric '${testName}':`, error);
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    } else {
      console.error(`Unknown error type:`, typeof error);
    }
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
