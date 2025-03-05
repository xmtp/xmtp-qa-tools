# XMTP SDK performance dashboard documentation

The XMTP SDK sends performance metrics to Datadog to track various aspects of SDK operations. Here's a breakdown of how metrics are collected and sent:

## Performance

![](/media/datadog.png)

**Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/sdk-performance?fromUser=false&tpl_var_geo%5B0%5D=us&from_ts=1740956007001&to_ts=1740956307001&live=true)

## Delivery

![](/media/delivery.png)

**Delivery Dashboard URL:** [SDK Delivery Dashboard](https://app.datadoghq.com/dashboard/pm2-3j8-yc5/xmtp-sdk-delivery?fromUser=false&from_ts=1741196398259&to_ts=1741199998259&live=true)

## Performance duration metric

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

## Message delivery metrics

In addition to performance metrics, the SDK also tracks message delivery reliability through the `xmtp.sdk.delivery_rate` metric:

```tsx
// ... existing code ...
// Send delivery rate metric
metrics.gauge("xmtp.sdk.delivery_rate", deliveryRate, [
  `libxmtp:${firstPersona.version}`,
  `test:${testName}`,
  `metric_type:reliability`,
  `members:${members}`,
]);
// ... existing code ...
```

### Delivery dashboard

The delivery dashboard visualizes message delivery rates and provides insights into the reliability of message delivery across different environments and regions.

#### Key metrics displayed:

1. **Message delivery rate (%)** - Shows the percentage of messages successfully delivered

   - Green: ≥ 99.9% delivery rate
   - Yellow: ≥ 99% delivery rate
   - Red: < 99% delivery rate

2. **Message delivery metrics over time** - Tracks delivery rate trends to identify patterns or issues

#### Dashboard filters:

The delivery dashboard supports filtering by:

- Environment (`env`) - Default: dev
- Geographic region (`geo`) - Default: us
- Test name (`test`) - Default: ts_delivery
- XMTP library version (`libxmtp`)
- Number of members in conversation (`members`)

Preset views are available for:

- US region
- Outside US (South America)

> See the full delivery metrics implementation in [helpers/datadog.ts](/helpers/datadog.ts)
