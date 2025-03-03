# XMTP SDK performance dashboard documentation

This document provides practical information about the SDK performance dashboard available in Datadog.

![](/media/datadog.png)

## Dashboard overview

The XMTP SDK performance dashboard tracks key metrics related to the performance of the XMTP SDK across different environments and operations.

**Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&tpl_var_geo%5B0%5D=us&from_ts=1740956007001&to_ts=1740956307001&live=true)

## Key metrics tracked

The dashboard tracks several important performance indicators:

- Message delivery times
- Client initialization performance
- Message listing performance
- Network request latency
- Error rates
- Resource utilization

## Using the dashboard

```bash
# Access the dashboard directly via the URL
open https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance
```

**Expected result:** You'll see a comprehensive view of SDK performance metrics that can be filtered by:

- Geographic region
- Time range
- Environment (production, dev)
- SDK version

## Filtering options

The dashboard supports various filtering options to narrow down the data:

```
# Example URL parameters
?tpl_var_geo[0]=us       # Filter by US region
&from_ts=1740956007001   # Start timestamp
&to_ts=1740956307001     # End timestamp
&live=true               # Enable live updates
```

**Expected result:** The dashboard will display filtered data based on your selected parameters.

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
- Unusual latency spikes
- Error patterns
- Regional performance differences

**Expected result:** You can use these insights to optimize SDK performance and troubleshoot issues affecting message delivery and client operations.
