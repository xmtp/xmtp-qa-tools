import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { getLatestSdkVersion, loadEnv } from "./client";
import {
  flushMetrics,
  getNetworkStats,
  parseTestName,
  sendMetric,
  type DurationMetricTags,
  type NetworkMetricTags,
} from "./datadog";

export const setupTestLifecycle = ({
  testName,
  sdk,
  getCustomDuration,
  setCustomDuration,
}: {
  testName: string;
  sdk?: string;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
}) => {
  beforeAll(() => {
    loadEnv(testName);
  });
  let skipNetworkStats = false;
  let start: number;
  beforeEach(() => {
    start = performance.now();
    const currentTestName = expect.getState().currentTestName;
    console.time(currentTestName);
    if (setCustomDuration) setCustomDuration(undefined); // Reset before each test if available
  });

  afterEach(async function () {
    const testName = expect.getState().currentTestName ?? "";
    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    const { testNameExtracted, operationType, operationName, members } =
      parseTestName(testName);

    const values: DurationMetricTags = {
      metric_type: "operation",
      metric_subtype: operationType,
      operation: operationName,
      test: testNameExtracted,
      sdk: sdk || getLatestSdkVersion(),
      installations: members,
      members,
    };

    sendMetric("log", duration, {
      metric_type: "log",
      metric_subtype: "test",
      test: testName,
    });
    if (testName.includes("m_") || process.env.XMTP_ENV === "local") {
      sendMetric("duration", duration, values);
    }

    // Network stats handling for performance tests
    if (testName.includes("m_performance") && !skipNetworkStats) {
      const networkStats = await getNetworkStats();

      for (const [statName, statValue] of Object.entries(networkStats)) {
        const networkPhase = statName.toLowerCase().replace(/\s+/g, "_") as
          | "dns_lookup"
          | "tcp_connection"
          | "tls_handshake"
          | "server_call"
          | "processing";

        const networkMetricTags: NetworkMetricTags = {
          metric_type: "network",
          metric_subtype: "phase",
          network_phase: networkPhase,
          sdk: sdk || getLatestSdkVersion(),
          operation: operationName,
          test: testNameExtracted,
        };
        sendMetric("duration", Math.round(statValue * 1000), networkMetricTags);
      }
    }

    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(async () => {
    await flushMetrics();
  });
};
