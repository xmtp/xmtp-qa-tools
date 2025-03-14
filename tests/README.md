# 🧪 XMTP Test Suites & Monitoring Documentation

This document provides a comprehensive overview of the XMTP testing infrastructure, organized by test suites and their associated workflows and monitoring dashboards.

## Workflow Overview

| Workflow           | Schedule     | Purpose                                                | Key Features                   |
| ------------------ | ------------ | ------------------------------------------------------ | ------------------------------ |
| **TS_Gm**          | Every 30 min | Tests GM bot functionality                             | Message exchange validation    |
| **TS_Delivery**    | Every 40 min | Tests message reliability across 200 streams           | High-volume delivery testing   |
| **TS_Performance** | Every 30 min | Measures XMTP network performance                      | Performance metrics collection |
| **TS_Geolocation** | Every 32 min | Measures geolocation of the library in the dev network | Geolocation metrics collection |

| Test Suite     | Dev Network Status                                                                                                                                                                     | Production Network Status                                                                                                                                                                                   | Run frequency |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 🚀 Performance | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_dev.yml) | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Performance_production.yml) | Every 30 min  |
| 📬 Delivery    | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_dev.yml)       | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Delivery_production.yml)       | Every 30 min  |
| 👋 Gm          | [![TS_Gm_dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_dev.yml)             | [![TS_Gm_production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm_production.yml)             | Every 30 min  |
| 🌎 Geolocation | [![Dev](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_dev.yml) | [![Production](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml/badge.svg)](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Geolocation_production.yml) | Every 30 min  |

## 🤖 TS_Gm Test Suite

The TS_Gm test suite verifies the reliability of the GM bot functionality, ensuring that the messaging service responds correctly to user interactions.

### Implementation Details

The test suite includes tests for:

- Direct messaging with the GM bot
- Verifying bot responses to messages
- Group messaging with the GM bot
- Testing with both direct bot address and Ethereum identifier formats

```javascript
// Example from TS_Gm implementation
it("gm-bot: should check if bot is alive", async () => {
  try {
    // Create conversation with the bot
    convo = await workers
      .get("bob")!
      .client.conversations.newDmWithIdentifier({
        identifierKind: IdentifierKind.Ethereum,
        identifier: gmBotAddress,
      });

    // Send a simple message and verify response
    await convo.send("gm");
    // ... verification logic
  } catch (e) {
    hasFailures = logError(e, expect);
    throw e;
  }
});
```

### Associated Workflow

The `TS_Gm.yml` workflow automates the test suite execution:

- ⏱️ **Schedule**: Runs every 30 minutes via cron schedule
- 🔄 **Retry Mechanism**: Uses up to 3 attempts for test stability
- 📊 **Reporting**: Reports test results to Datadog for monitoring
- 🧪 **Environment**: Tests against the configured GM bot address in Dev

```bash
# Manually trigger the workflow
# Navigate to: Actions > TS_Gm > Run workflow
```

### Monitoring Dashboard

Results from this test suite feed into the [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nz), which provides real-time visibility into test execution status and is connected to the `#notify-eng-testing` Slack channel for alerts.

## 📨 TS_Delivery Test Suite

The TS_Delivery test suite evaluates message delivery reliability across multiple streams, ensuring messages are delivered correctly and in order.

### Implementation Details

This test suite tests:

- Message delivery in streaming mode
- Message order verification
- Message delivery via polling
- Offline recovery (message recovery after disconnection)

Configurable parameters include:

```javascript
// Configuration parameters from TS_Delivery
const amountofMessages = parseInt(
  process.env.CLI_DELIVERY_AMOUNT ?? process.env.DELIVERY_AMOUNT ?? "10",
);
const receiverAmount = parseInt(
  process.env.CLI_DELIVERY_RECEIVERS ?? process.env.DELIVERY_RECEIVERS ?? "4",
);
```

Key test implementations:

```javascript
// Example from TS_Delivery implementation
it("tc_stream_order: verify message order when receiving via streams", () => {
  try {
    // Verify message reception and order
    const stats = calculateMessageStats(
      messagesByWorker,
      "gm-",
      amountofMessages,
      randomSuffix,
    );

    // We expect all messages to be received and in order
    expect(stats.receptionPercentage).toBeGreaterThan(95);
    expect(stats.orderPercentage).toBeGreaterThan(95);

    // Report metrics to Datadog
    sendDeliveryMetric(
      stats.receptionPercentage,
      workers.get("bob")!.version,
      testName,
      "stream",
      "delivery",
    );
  } catch (e) {
    hasFailures = logError(e, expect);
    throw e;
  }
});
```

### Associated Workflow

The `TS_Delivery.yml` workflow automates this test suite execution:

- ⏱️ **Schedule**: Runs every 40 minutes via cron schedule
- 🔧 **Configuration**: Optimizes system resources for SQLCipher performance
- 🔍 **Error Handling**: Uses sophisticated filtering for transient issues
- 🔄 **Retry Logic**: Implements up to 3 retry attempts for stability
- 📊 **Metrics**: Sends detailed metrics to Datadog for tracking
- ⚙️ **Configuration**: Supports adjustable message volume via environment variables

### Monitoring Dashboard

This test suite feeds data to the [SDK Delivery Dashboard](https://app.datadoghq.com/dashboard/pm2-3j8-yc5), which visualizes:

1. **Message Delivery Rate (%)**

   - 🟢 **Green**: ≥ 99.9% delivery rate
   - 🟡 **Yellow**: ≥ 99% delivery rate
   - 🔴 **Red**: < 99% delivery rate

2. **Delivery Trends** - Historical view of delivery rates to identify patterns

The dashboard supports filtering by environment, geographic region, test name, library version, and participant count.

#### Message Delivery Metrics

The test suite reports delivery reliability via the `xmtp.sdk.delivery_rate` metric:

```tsx
// Send delivery rate metric
metrics.gauge("xmtp.sdk.delivery_rate", deliveryRate, [
  `libxmtp:${firstWorker.version}`,
  `test:${testName}`,
  `metric_type:reliability`,
  `members:${members}`,
]);
```

## ⚡ TS_Performance Test Suite

The TS_Performance test suite measures XMTP network performance across various operations, providing insights into system scalability and responsiveness.

### Implementation Details

This comprehensive test suite evaluates:

- Client creation performance
- Inbox state retrieval speeds
- Direct message (DM) creation and communication latency
- Group creation with various sizes (configurable batch and total size)
- Group creation using different identifier methods
- Group synchronization efficiency
- Group name update latency
- Member removal performance
- Group messaging and verification throughput

Configuration parameters include:

```javascript
// Configuration parameters from TS_Performance
const batchSize = parseInt(
  process.env.CLI_BATCH_SIZE ?? process.env.BATCH_SIZE ?? "5",
);
const total = parseInt(
  process.env.CLI_GROUP_SIZE ?? process.env.MAX_GROUP_SIZE ?? "10",
);
```

Example test implementation:

```javascript
// Example from TS_Performance implementation
it(`createGroup-${i}: should create a large group of ${i} participants ${i}`, async () => {
  try {
    const sliced = generatedInboxes.slice(0, i);
    newGroup = await workers
      .get("henry")!
      .client.conversations.newGroup(sliced.map((inbox) => inbox.inboxId));
    expect(newGroup.id).toBeDefined();
  } catch (e) {
    hasFailures = logError(e, expect);
    throw e;
  }
});
```

### Associated Workflow

The `TS_Performance.yml` workflow automates this test suite:

- ⏱️ **Schedule**: Runs every 30 minutes via cron schedule
- ⚙️ **Configuration**: Supports adjustable batch size and group size parameters
- 🔄 **Retry Mechanism**: Implements retry logic for test stability
- 📊 **Metrics**: Reports comprehensive performance metrics to Datadog
- 👁️ **Visibility**: Provides real-time visibility into XMTP network performance

### Monitoring Dashboard

Performance metrics feed into the [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/), which visualizes:

- Operation durations across different functions
- Network performance metrics
- Scalability indicators for various group sizes

#### Performance Metrics Collection

The test suite reports detailed performance metrics via the `xmtp.sdk.duration` metric:

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

#### Network Performance Metrics

For each operation, the test suite tracks network performance across five phases:

| Phase            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `dns_lookup`     | DNS resolution time                                                |
| `tcp_connection` | TCP connection establishment time                                  |
| `tls_handshake`  | TLS handshake duration                                             |
| `server_call`    | Server response time                                               |
| `processing`     | Server processing time (calculated as server_call - tls_handshake) |

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

## 📊 TS_Geolocation Test Suite

The TS_Geolocation test suite measures the geographical performance of the XMTP library across different regions, providing insights into regional variations in performance and reliability.

### Implementation Details

While specific implementation details aren't provided in the documentation, this test suite likely evaluates:

- Regional performance differences
- Latency variations across geographic locations
- Network reliability in different regions

### Associated Workflow

The `TS_Geolocation.yml` workflow automates this test suite:

- ⏱️ **Schedule**: Runs every 32 minutes via cron schedule
- 📊 **Reporting**: Reports geolocation metrics to Datadog for monitoring

### Monitoring Dashboard

Geolocation data feeds into both the main [Workflow Dashboard](https://app.datadoghq.com/dashboard/9we-bpa-nz) and has preset filters in the delivery dashboard for regional comparisons:

- US region performance
- South America region performance

## 📊 Unified Monitoring & Observability

All test suites integrate with Datadog monitoring that provides:

- 📝 Status events with detailed context for each test run
- 📈 Success/failure metrics for monitoring
- 🏷️ Data tagging with repository, branch, and trigger information
- 🔗 Links to GitHub workflow runs for easy debugging
- 🚨 Alerting capabilities for test failures

### Metric Tagging System

All metrics use a consistent tagging system to enable precise filtering and analysis:

| Tag           | Description                              |
| ------------- | ---------------------------------------- |
| `libxmtp`     | XMTP library version                     |
| `operation`   | Specific operation being measured        |
| `test`        | Test name                                |
| `metric_type` | "operation" or "network"                 |
| `description` | Additional context                       |
| `members`     | Number of members (for group operations) |

These automated test suites and their monitoring infrastructure form a critical part of XMTP's continuous quality assurance system, ensuring network reliability and performance for all developers building on the protocol.
