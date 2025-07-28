// Enhanced metrics system - main export file
// This consolidates all metrics optimization utilities

// Core functionality
export { 
  setupTestLifecycle, 
  getMetricsCollector 
} from "./vitest";

// Optimization utilities  
export {
  measurePerformance,
  BatchMetricsSender,
  MetricsAggregator,
  sendConditionalMetric,
  RateLimitedMetrics
} from "./metrics-utils";

// DataDog types for backward compatibility
export type {
  ResponseMetricTags,
  DeliveryMetricTags,
  DurationMetricTags,
  NetworkMetricTags,
} from "./datadog";

// Legacy export for backward compatibility
export { sendMetric } from "./datadog";

/**
 * USAGE EXAMPLES:
 * 
 * 1. Basic setup:
 * ```ts
 * import { setupTestLifecycle, getMetricsCollector } from "@helpers/metrics";
 * 
 * const { metricsCollector } = setupTestLifecycle({
 *   testName: "my-test",
 *   sendMetrics: true,
 *   sendDurationMetrics: true,
 * });
 * ```
 * 
 * 2. Send optimized response metrics:
 * ```ts
 * const collector = getMetricsCollector();
 * collector?.sendResponseMetric(150.5, {
 *   metricSubtype: "message",
 *   customTags: { agent: "test-agent" }
 * });
 * ```
 * 
 * 3. Send delivery metrics:
 * ```ts
 * collector?.sendDeliveryMetric(98.5, "delivery", {
 *   conversationType: "group",
 *   metricSubtype: "stream"
 * });
 * ```
 * 
 * 4. Performance measurement:
 * ```ts
 * import { measurePerformance } from "@helpers/metrics";
 * 
 * const result = await measurePerformance(
 *   () => someAsyncOperation(),
 *   "operation_name",
 *   { metricSubtype: "critical" }
 * );
 * ```
 * 
 * 5. Batch operations:
 * ```ts
 * import { BatchMetricsSender } from "@helpers/metrics";
 * 
 * const batch = new BatchMetricsSender({ batchSize: 5 });
 * batch.sendResponseMetrics([
 *   { value: 100, metricSubtype: "message" },
 *   { value: 150, metricSubtype: "verification" }
 * ]);
 * ```
 */