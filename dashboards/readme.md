# XMTP SDK performance dashboard documentation

The XMTP SDK sends performance metrics to Datadog to track various aspects of SDK operations. Here's a breakdown of how metrics are collected and sent:

![](/media/datadog.png)

**Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&tpl_var_geo%5B0%5D=us&from_ts=1740956007001&to_ts=1740956307001&live=true)

## Main metric: Duration

The primary metric sent to Datadog is `xmtp.sdk.duration`, which measures the time taken for various SDK operations.

```tsx
// ... existing code ...
const durationMetricName = `xmtp.sdk.duration`;

// Send main operation metric
metrics.gauge(durationMetricName, value, [
  `libxmtp:${firstPersona.version}`,
  `operation:${operationName}`,
  `test:${testName}`,
  `metric_type:operation`,
  `description:${metricDescription}`,
  `members:${members}`,
]);
// ... existing code ...
```

## Tags used for metrics

Each metric is tagged with relevant information to enable filtering and analysis:

1. `libxmtp` - The version of the XMTP library being used
2. `operation` - The specific operation being measured (extracted from the metric name)
3. `test` - The name of the test being run
4. `metric_type` - Either "operation" or "network"
5. `description` - Additional context about what's being measured
6. `members` - Number of members involved (for group operations)

## Network performance metrics

In addition to operation metrics, network performance is also tracked:

```tsx
// ... existing code ...
// Handle network stats if needed
if (!skipNetworkStats) {
  const networkStats = await getNetworkStats();

  for (const [statName, statValue] of Object.entries(networkStats)) {
    const metricValue = statValue * 1000; // Convert to milliseconds
    metrics.gauge(durationMetricName, metricValue, [
      `libxmtp:${firstPersona.version}`,
      `operation:${operationName}`,
      `test:${testName}`,
      `metric_type:network`,
      `network_phase:${statName.toLowerCase().replace(/\s+/g, "_")}`,
    ]);
  }
}
// ... existing code ...
```

> See the network stats [function](/helpers/datadog.ts)

## Network phases measured

The following network phases are measured and reported:

1. `dns_lookup` - Time taken for DNS resolution
2. `tcp_connection` - Time taken to establish TCP connection
3. `tls_handshake` - Time taken for TLS handshake
4. `server_call` - Time taken for the server to respond
5. `processing` - Time taken for server processing (calculated as server_call - tls_handshake)
