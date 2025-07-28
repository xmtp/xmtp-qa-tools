import { getMetricsCollector } from "./vitest";
import type { ResponseMetricTags, DeliveryMetricTags } from "./datadog";

/**
 * High-level utility functions for common metric operations
 * These provide even more encapsulation for frequently used patterns
 */

// Performance measurement wrapper
export function measurePerformance<T>(
  operation: () => Promise<T> | T,
  metricName: string = "performance",
  options: {
    metricSubtype?: string;
    customTags?: Record<string, any>;
    immediate?: boolean;
  } = {}
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = performance.now();
    const collector = getMetricsCollector();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      collector?.sendCustomMetric(metricName, duration, {
        metric_type: "performance",
        metric_subtype: options.metricSubtype || "execution",
        ...options.customTags,
      }, { immediate: options.immediate });
      
      resolve(result);
    } catch (error) {
      const duration = performance.now() - start;
      
      collector?.sendCustomMetric(`${metricName}_error`, duration, {
        metric_type: "performance",
        metric_subtype: "error",
        ...options.customTags,
      }, { immediate: true }); // Errors are sent immediately
      
      reject(error);
    }
  });
}

// Batch metric sender for bulk operations
export class BatchMetricsSender {
  private collector = getMetricsCollector();
  private batchSize: number;
  private autoFlush: boolean;
  
  constructor(options: { batchSize?: number; autoFlush?: boolean } = {}) {
    this.batchSize = options.batchSize || 10;
    this.autoFlush = options.autoFlush ?? true;
  }
  
  // Send multiple response metrics at once
  sendResponseMetrics(
    measurements: Array<{
      value: number;
      metricSubtype?: "message" | "verification" | "processing";
      customTags?: Partial<ResponseMetricTags>;
    }>
  ) {
    measurements.forEach(measurement => {
      this.collector?.sendResponseMetric(measurement.value, {
        metricSubtype: measurement.metricSubtype,
        customTags: measurement.customTags,
      });
    });
    
    if (this.autoFlush && measurements.length >= this.batchSize) {
      this.collector?.flushQueuedMetrics();
    }
  }
  
  // Send multiple delivery metrics at once
  sendDeliveryMetrics(
    measurements: Array<{
      value: number;
      metricType: "delivery" | "order";
      metricSubtype?: "stream" | "poll" | "recovery";
      conversationType?: "dm" | "group";
      customTags?: Partial<DeliveryMetricTags>;
    }>
  ) {
    measurements.forEach(measurement => {
      this.collector?.sendDeliveryMetric(measurement.value, measurement.metricType, {
        metricSubtype: measurement.metricSubtype,
        conversationType: measurement.conversationType,
        customTags: measurement.customTags,
      });
    });
    
    if (this.autoFlush && measurements.length >= this.batchSize) {
      this.collector?.flushQueuedMetrics();
    }
  }
  
  // Manual flush
  async flush() {
    await this.collector?.flushQueuedMetrics();
  }
}

// Metrics aggregation helper
export class MetricsAggregator {
  private measurements: Array<{ name: string; value: number; timestamp: number }> = [];
  
  add(name: string, value: number) {
    this.measurements.push({
      name,
      value,
      timestamp: performance.now(),
    });
  }
  
  // Send aggregated statistics
  sendAggregated(options: {
    sendIndividual?: boolean;
    sendStats?: boolean;
    metricPrefix?: string;
  } = {}) {
    const collector = getMetricsCollector();
    if (!collector) return;
    
    const { sendIndividual = false, sendStats = true, metricPrefix = "agg" } = options;
    
    // Group by metric name
    const grouped = this.measurements.reduce((acc, measurement) => {
      if (!acc[measurement.name]) {
        acc[measurement.name] = [];
      }
      acc[measurement.name].push(measurement.value);
      return acc;
    }, {} as Record<string, number[]>);
    
    Object.entries(grouped).forEach(([name, values]) => {
      if (sendIndividual) {
        values.forEach(value => {
          collector.sendCustomMetric(`${metricPrefix}_${name}`, value, {
            metric_type: "aggregated",
            metric_subtype: "individual",
          });
        });
      }
      
      if (sendStats) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const p95 = this.percentile(values, 0.95);
        
        collector.sendCustomMetric(`${metricPrefix}_${name}_avg`, avg, {
          metric_type: "aggregated",
          metric_subtype: "average",
        });
        
        collector.sendCustomMetric(`${metricPrefix}_${name}_min`, min, {
          metric_type: "aggregated",
          metric_subtype: "minimum",
        });
        
        collector.sendCustomMetric(`${metricPrefix}_${name}_max`, max, {
          metric_type: "aggregated",
          metric_subtype: "maximum",
        });
        
        collector.sendCustomMetric(`${metricPrefix}_${name}_p95`, p95, {
          metric_type: "aggregated",
          metric_subtype: "percentile_95",
        });
      }
    });
    
    this.clear();
  }
  
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }
  
  clear() {
    this.measurements = [];
  }
  
  getStats() {
    return {
      count: this.measurements.length,
      timespan: this.measurements.length > 0 
        ? this.measurements[this.measurements.length - 1].timestamp - this.measurements[0].timestamp
        : 0,
    };
  }
}

// Conditional metrics helper
export function sendConditionalMetric(
  condition: boolean | (() => boolean),
  metricName: string,
  value: number,
  tags: Record<string, any>,
  options: { immediate?: boolean } = {}
) {
  const shouldSend = typeof condition === 'function' ? condition() : condition;
  if (!shouldSend) return;
  
  const collector = getMetricsCollector();
  collector?.sendCustomMetric(metricName, value, tags, options);
}

// Rate limiting helper for high-frequency metrics
export class RateLimitedMetrics {
  private lastSent = new Map<string, number>();
  private minInterval: number;
  
  constructor(minIntervalMs: number = 1000) {
    this.minInterval = minIntervalMs;
  }
  
  send(
    metricName: string,
    value: number,
    tags: Record<string, any>,
    options: { immediate?: boolean; force?: boolean } = {}
  ) {
    const key = `${metricName}_${JSON.stringify(tags)}`;
    const now = Date.now();
    const lastSent = this.lastSent.get(key) || 0;
    
    if (options.force || now - lastSent >= this.minInterval) {
      const collector = getMetricsCollector();
      collector?.sendCustomMetric(metricName, value, tags, options);
      this.lastSent.set(key, now);
      return true;
    }
    
    return false; // Rate limited
  }
}