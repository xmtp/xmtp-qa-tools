import "dotenv/config";
import { getLatestVersion } from "version-management/client-versions";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { loadEnv } from "./client";
import {
  flushMetrics,
  getNetworkStats,
  initializeDatadog,
  sendMetric,
  type DurationMetricTags,
  type NetworkMetricTags,
} from "./datadog";

export const setupDurationTracking = ({
  testName,
  sdk,
  getCustomDuration,
  setCustomDuration,
  initDataDog = false,
  sendDurationMetrics = false,
  networkStats = false,
}: {
  testName: string;
  sdk?: string;
  getCustomDuration?: () => number | undefined;
  setCustomDuration?: (v: number | undefined) => void;
  initDataDog?: boolean;
  sendDurationMetrics?: boolean;
  networkStats?: boolean;
}) => {
  beforeAll(() => {
    loadEnv(testName);
    if (initDataDog) initializeDatadog();
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
    const currentTestName = expect.getState().currentTestName ?? "";
    console.log(currentTestName);
    let duration = performance.now() - start;
    if (getCustomDuration) {
      const customDuration = getCustomDuration();
      if (typeof customDuration === "number") {
        duration = customDuration;
      }
    }
    const {
      testNameExtracted,
      operationType,
      operationName,
      members,
      conversation_count,
    } = parseTestName(currentTestName);

    if (initDataDog && sendDurationMetrics) {
      sendMetric("duration", duration, {
        metric_type: "operation",
        metric_subtype: operationType,
        operation: operationName,
        conversation_count,
        test: testNameExtracted,
        sdk: sdk || getLatestVersion(),
        installations: members,
        members,
      } as DurationMetricTags);
    }

    // Network stats handling for performance tests
    if (
      initDataDog &&
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
          sdk: sdk || getLatestVersion(),
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
      sdk: sdk || getLatestVersion(),
    });
  });
};
interface ParsedTestName {
  metricName: string;
  metricDescription: string;
  testNameExtracted: string;
  operationType: "group" | "core";
  operationName: string;
  members: string;
  conversation_count: string;
}
// Test name parsing - simplified
export function parseTestName(testName: string): ParsedTestName {
  const [metricNameParts, metricDescription = ""] = testName.split(":");
  const metricName = metricNameParts.replaceAll(" > ", ".");
  const operationParts = metricName.split(".");

  let testNameExtracted = operationParts[0];

  let operationName = "";
  let members = "";
  let conversation_count = "";

  if (operationParts[1]) {
    // Handle different patterns:
    // 1. Simple operation name: "create", "sync", "newDm"
    // 2. Operation with number: "newGroup-10", "send-5"
    // 3. Operation with number and parentheses: "newGroup-10(1000)"
    const match = operationParts[1].match(/^([a-zA-Z]+)-?(\d+)?\(?(\d+)?\)?$/);
    if (match) {
      [, operationName, members = "", conversation_count = ""] = match;
    } else {
      // If regex doesn't match, use the entire part as operation name
      operationName = operationParts[1];
    }
  }

  // Ensure operationName is never empty - use a fallback
  if (!operationName && operationParts[1]) {
    operationName = operationParts[1];
  }

  return {
    metricName,
    metricDescription,
    testNameExtracted,
    operationType: parseInt(members) > 5 ? "group" : "core",
    operationName,
    members,
    conversation_count,
  };
}
