# 📊 XMTP Datadog Monitoring

The XMTP SDK sends comprehensive performance metrics to Datadog to track various aspects of SDK operations. This document provides a detailed overview of our monitoring infrastructure.

## Dashboard Overview

### 🔄 Workflow Dashboard

**Dashboard URL:** [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nz)

![Workflow Dashboard](/media/workflows.png)

This dashboard tracks our three continuous workflows and is connected to the `#notify-eng-testing` Slack channel for real-time alerts and notifications.

### ⚡ Performance Dashboard

**Dashboard URL:** [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/)

![Performance Dashboard](/media/performance.png)

## Metrics Collection

The primary metric sent to Datadog is `xmtp.sdk.duration`, which measures execution time across various SDK operations.

```tsx
// Send main operation metric
const durationMetricName = `xmtp.sdk.duration`;

metrics.gauge(durationMetricName, value, [
  `libxmtp:${firstWorker.version}`,
  `operation:${operationName}`,
  `test:${testName}`,
  `metric_type:operation`,
  `description:${metricDescription}`,
  `members:${members}`,
]);
```

### Metric Tagging System

Each metric uses the following tags to enable precise filtering and analysis:

| Tag           | Description                              |
| ------------- | ---------------------------------------- |
| `libxmtp`     | XMTP library version                     |
| `operation`   | Specific operation being measured        |
| `test`        | Test name                                |
| `metric_type` | "operation" or "network"                 |
| `description` | Additional context                       |
| `members`     | Number of members (for group operations) |

### Network Performance Metrics

In addition to core operation metrics, we track detailed network performance:

```tsx
// Handle network stats
if (!skipNetworkStats) {
  const networkStats = await getNetworkStats();

  for (const [statName, statValue] of Object.entries(networkStats)) {
    const metricValue = statValue * 1000; // Convert to milliseconds
    metrics.gauge(durationMetricName, metricValue, [
      `libxmtp:${firstWorker.version}`,
      `operation:${operationName}`,
      `test:${testName}`,
      `metric_type:network`,
      `network_phase:${statName.toLowerCase().replace(/\s+/g, "_")}`,
    ]);
  }
}
```

> For implementation details, see the network stats [function](/helpers/datadog.ts)

#### Network Phases Monitored

We track five key network phases:

| Phase            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `dns_lookup`     | DNS resolution time                                                |
| `tcp_connection` | TCP connection establishment time                                  |
| `tls_handshake`  | TLS handshake duration                                             |
| `server_call`    | Server response time                                               |
| `processing`     | Server processing time (calculated as server_call - tls_handshake) |

### 📨 Message Delivery Dashboard

**Dashboard URL:** [SDK Delivery Dashboard](https://app.datadoghq.com/dashboard/pm2-3j8-yc5)

![Delivery Dashboard](/media/ts_delivery.png)

Beyond performance metrics, we track message delivery reliability through the `xmtp.sdk.delivery_rate` metric:

```tsx
// Send delivery rate metric
metrics.gauge("xmtp.sdk.delivery_rate", deliveryRate, [
  `libxmtp:${firstWorker.version}`,
  `test:${testName}`,
  `metric_type:reliability`,
  `members:${members}`,
]);
```

#### Key Reliability Indicators

The delivery dashboard provides critical insights into message reliability:

1. **Message Delivery Rate (%)**

   - 🟢 **Green**: ≥ 99.9% delivery rate
   - 🟡 **Yellow**: ≥ 99% delivery rate
   - 🔴 **Red**: < 99% delivery rate

2. **Delivery Trends** - Historical view of delivery rates to identify patterns or regressions

#### Filter Capabilities

The delivery dashboard supports comprehensive filtering by:

| Filter                      | Description            | Default     |
| --------------------------- | ---------------------- | ----------- |
| Environment (`env`)         | Deployment environment | dev         |
| Geographic region (`geo`)   | Server location        | us          |
| Test name (`test`)          | Specific test scenario | ts_delivery |
| Library version (`libxmtp`) | XMTP SDK version       | -           |
| Members (`members`)         | Number of participants | -           |

**Preset Views:**

- US region performance
- South America region performance
