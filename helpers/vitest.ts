import { getVersions } from "@workers/versions";
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
        sdk: sdk || getVersions()[0].nodeSDK,
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
    // Updated regex to handle optional conversation_count size: operationName-number(conversation_countSize)
    const match = operationParts[1].match(/^([a-zA-Z]+)-?(\d+)?\(?(\d+)?\)?$/);
    if (match) {
      [, operationName, members = "", conversation_count = ""] = match;
    } else {
      operationName = operationParts[1];
    }
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
