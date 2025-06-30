import type { WorkerManager } from "@workers/manager";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  type ExpectStatic,
} from "vitest";
import { loadEnv } from "./client";
import {
  flushMetrics,
  getNetworkStats,
  parseTestName,
  sendMetric,
  type DurationMetricTags,
} from "./datadog";

export const setupTestLifecycle = ({
  testName,
  expect,
  workers,
  getCustomDuration,
  setCustomDuration,
}: {
  testName: string;
  expect: ExpectStatic;
  workers?: WorkerManager;
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

    // Get version info from workers if available
    const libXmtpVersion = workers?.getCreator()?.libXmtpVersion || "unknown";
    const sdkVersion = workers?.getCreator()?.sdkVersion || "unknown";

    const values: DurationMetricTags = {
      metric_type: "operation",
      metric_subtype: operationType,
      operation: operationName,
      test: testNameExtracted,
      sdk: sdkVersion,
      installations: members,
      members,
    };

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

        sendMetric("duration", Math.round(statValue * 1000), {
          metric_type: "network",
          metric_subtype: networkPhase,
          sdk: sdkVersion,
          operation: operationName,
          test: testNameExtracted,
          network_phase: networkPhase,
        });
      }
    }

    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(async () => {
    await flushMetrics();
  });
};
