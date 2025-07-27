import { getVersions } from "@workers/versions";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { loadEnv } from "./client";
import {
  flushMetrics,
  getNetworkStats,
  initDataDog,
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
  sendMetrics = false,
  sendDurationMetrics = false,
  networkStats = false,
}: {
  testName: string;
  sdk?: string;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
  sendMetrics?: boolean;
  sendDurationMetrics?: boolean;
  networkStats?: boolean;
}) => {
  beforeAll(() => {
    loadEnv(testName);
    if (sendMetrics) initDataDog();
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

    if (sendMetrics && sendDurationMetrics) {
      sendMetric("duration", duration, {
        metric_type: "operation",
        metric_subtype: operationType,
        operation: operationName,
        test: testNameExtracted,
        sdk: sdk || getVersions()[0].nodeSDK,
        installations: members,
        members,
      } as DurationMetricTags);
    }

    // Network stats handling for performance tests
    if (
      sendMetrics &&
      sendDurationMetrics &&
      networkStats &&
      !skipNetworkStats
    ) {
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
          sdk: sdk || getVersions()[0].nodeSDK,
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
    sendMetric("duration", performance.now() - start, {
      metric_type: "test",
      metric_subtype: "duration",
      test: testName,
      sdk: sdk || getVersions()[0].nodeSDK,
    });
  });
};
