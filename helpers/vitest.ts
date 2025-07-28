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
  type ResponseMetricTags,
  type DeliveryMetricTags,
  type MetricTags,
} from "./datadog";

// Enhanced metrics collector for better encapsulation
class MetricsCollector {
  private testName: string;
  private sdk: string;
  private sendMetrics: boolean;
  private queuedMetrics: Array<{
    name: string;
    value: number;
    tags: MetricTags;
    timestamp: number;
  }> = [];

  constructor(testName: string, sdk: string, sendMetrics: boolean) {
    this.testName = testName;
    this.sdk = sdk;
    this.sendMetrics = sendMetrics;
  }

  // Encapsulated response metrics sending
  sendResponseMetric(
    value: number,
    options: {
      metricSubtype?: "message" | "verification" | "processing";
      customTags?: Partial<ResponseMetricTags>;
    } = {}
  ) {
    if (!this.sendMetrics) return;

    const { testNameExtracted } = parseTestName(this.testName);
    const tags: ResponseMetricTags = {
      test: testNameExtracted,
      metric_type: "stream",
      metric_subtype: options.metricSubtype || "message",
      sdk: this.sdk,
      ...options.customTags,
    };

    this.queueMetric("response", value, tags);
  }

  // Encapsulated delivery metrics sending
  sendDeliveryMetric(
    value: number,
    metricType: "delivery" | "order",
    options: {
      metricSubtype?: "stream" | "poll" | "recovery";
      conversationType?: "dm" | "group";
      customTags?: Partial<DeliveryMetricTags>;
    } = {}
  ) {
    if (!this.sendMetrics) return;

    const { testNameExtracted } = parseTestName(this.testName);
    const tags: DeliveryMetricTags = {
      sdk: this.sdk,
      test: testNameExtracted,
      metric_type: metricType,
      metric_subtype: options.metricSubtype || "stream",
      conversation_type: options.conversationType || "group",
      ...options.customTags,
    };

    this.queueMetric(metricType, value, tags);
  }

  // Generic metric sending with intelligent defaults
  sendCustomMetric(
    metricName: string,
    value: number,
    tags: Partial<MetricTags>,
    options: { immediate?: boolean } = {}
  ) {
    if (!this.sendMetrics) return;

    const { testNameExtracted } = parseTestName(this.testName);
    const enrichedTags: MetricTags = {
      test: testNameExtracted,
      sdk: this.sdk,
      metric_type: "custom",
      metric_subtype: "measurement",
      ...tags,
    };

    if (options.immediate) {
      sendMetric(metricName, value, enrichedTags);
    } else {
      this.queueMetric(metricName, value, enrichedTags);
    }
  }

  // Queue metrics for batch sending
  private queueMetric(name: string, value: number, tags: MetricTags) {
    this.queuedMetrics.push({
      name,
      value,
      tags,
      timestamp: performance.now(),
    });
  }

  // Batch send all queued metrics
  async flushQueuedMetrics() {
    if (!this.sendMetrics || this.queuedMetrics.length === 0) return;

    // Sort by timestamp for proper ordering
    this.queuedMetrics.sort((a, b) => a.timestamp - b.timestamp);

    // Send all metrics in a batch
    for (const metric of this.queuedMetrics) {
      sendMetric(metric.name, metric.value, metric.tags);
    }

    // Clear the queue
    this.queuedMetrics = [];
  }

  // Get queue status for debugging
  getQueueStatus() {
    return {
      count: this.queuedMetrics.length,
      metrics: this.queuedMetrics.map(m => ({ name: m.name, value: m.value })),
    };
  }
}

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
  const effectiveSdk = sdk || getVersions()[0].nodeSDK;
  const metricsCollector = new MetricsCollector(testName, effectiveSdk, sendMetrics);
  
  // Export the collector for use in tests
  (globalThis as any).__metricsCollector = metricsCollector;

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
    console.log(testName);
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
        sdk: effectiveSdk,
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
          sdk: effectiveSdk,
          operation: operationName,
          test: testNameExtracted,
        };
        sendMetric("duration", Math.round(statValue * 1000), networkMetricTags);
      }
    }

    // Flush any queued metrics from the test
    await metricsCollector.flushQueuedMetrics();

    if (setCustomDuration) setCustomDuration(undefined); // Reset after each test if available
  });

  afterAll(async () => {
    await flushMetrics();
    sendMetric("duration", performance.now() - start, {
      metric_type: "test",
      metric_subtype: "duration",
      test: testName,
      sdk: effectiveSdk,
    });
  });

  // Return the metrics collector for direct access
  return { metricsCollector };
};

// Helper function to get the global metrics collector
export function getMetricsCollector(): MetricsCollector | null {
  return (globalThis as any).__metricsCollector || null;
}
