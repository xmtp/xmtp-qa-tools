# XMTP SDK performance dashboard documentation

This document provides practical information about the SDK performance dashboard available in Datadog.

![](/media/datadog.png)

## Dashboard overview

The XMTP SDK performance dashboard tracks key metrics related to the performance of the XMTP SDK across different environments and operations.

**Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&tpl_var_geo%5B0%5D=us&from_ts=1740956007001&to_ts=1740956307001&live=true)

## Key metrics tracked

The dashboard tracks several important performance indicators:

- Message delivery times
- Group creation performance
- Network request latency

## Dashboard configuration

The dashboard configuration is stored in `dashboards/ts_performance.json`. This file defines:

- Widget layouts
- Metric queries
- Visualization types
- Alert thresholds

**Usage:** This JSON file can be imported into Datadog to recreate or modify the dashboard.

## Interpreting results

The dashboard helps identify:

- Performance bottlenecks
- Expected benchmarks
- Unusual latency spikes
- Error patterns
- Regional differences
