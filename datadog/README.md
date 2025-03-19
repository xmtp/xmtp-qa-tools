# XMTP Datadog integration

This module provides tools for monitoring XMTP performance metrics via Datadog integration.

## Overview

The XMTP Datadog integration allows you to track crucial performance metrics, message delivery rates, and network statistics for your XMTP implementation. This data helps maintain optimal service quality and quickly identify potential issues.

## Key components

- `summary.ts` - Aggregates and formats metrics data
- `helper.ts` - Utility functions for Datadog integration
- `network.ts` - Network performance monitoring tools
- `thresholds.json` - Configuration for alert thresholds
- `dashboards/` - Datadog dashboard configuration files

## Usage examples

```typescript
// Initialize Datadog metrics
initDataDog(testName, envValue, geolocation, apiKey);

// Send delivery rate metrics
sendDeliveryMetric(deliveryRate, testName, libxmtpVersion);

// Send performance metrics
sendPerformanceMetric(durationMs, testName, libxmtpVersion);

// Measure network performance
const networkStats = await getNetworkStats();
```

## Common metrics

- Message delivery rates
- End-to-end message latency
- Network performance statistics
- API response times
- Error rates and types

## Dashboard integration

The `dashboards/` directory contains configuration for visualizing your XMTP metrics in Datadog. These dashboards provide real-time monitoring of your application's performance.

- [Performance Dashboard](./dashboards/performance.json)
- [Delivery Rate Dashboard](./dashboards/delivery-rate.json)
- [Network Performance Dashboard](./dashboards/network-performance.json)
