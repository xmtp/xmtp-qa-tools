# SLOs and SLIs

These are the performance targets we actually commit to hitting and the metrics we use to track whether we're delivering a good experience to users. Think of SLOs as promises we make about how reliable XMTP will be, and SLIs as the measurements that tell us if we're keeping those promises.

## Core SLIs (service level indicators)

### 1. Message delivery rate

**What it means**: What percentage of messages actually make it from sender to recipient without getting lost.

**How we calculate it**:

```sql
delivery_rate = (messages_delivered / messages_sent) * 100
```

**SLI Query**:

```
sum:xmtp.sdk.messages.delivered{env:*} / sum:xmtp.sdk.messages.sent{env:*} * 100
```

**Tracking Windows**:

- Real-time: 5-minute rolling window
- SLO calculation: 24-hour window
- Historical analysis: 7-day and 30-day windows

### 2. Message latency

**Definition**: Time from message send to delivery confirmation.

**Measurement**:

```sql
latency = message_delivery_timestamp - message_send_timestamp
```

**SLI Query**:

```
avg:xmtp.sdk.latency{env:*}
```

**Percentiles Tracked**:

- P50 (median): Typical user experience
- P95: Good user experience threshold
- P99: Exceptional user experience
- P99.9: Critical edge cases

### 3. Cross-platform compatibility rate

**Definition**: Success rate of message delivery between different SDK implementations.

**Measurement**:

```sql
compatibility_rate = (successful_cross_platform_messages / total_cross_platform_messages) * 100
```

**SLI Query**:

```
sum:xmtp.sdk.cross_platform.success{*} / sum:xmtp.sdk.cross_platform.attempts{*} * 100
```

### 4. Service availability

**Definition**: Percentage of time XMTP network services are operational.

**Measurement**:

```sql
availability = (uptime_seconds / total_seconds) * 100
```

**SLI Query**:

```
avg:xmtp.network.uptime{service:*}
```

### 5. Agent response time

**Definition**: Time for automated agents to respond to incoming messages.

**Measurement**:

```sql
response_time = agent_response_timestamp - message_received_timestamp
```

**SLI Query**:

```
avg:xmtp.agent.response_time{agent:*}
```

## SLO targets

| SLI                          | SLO Target  | Measurement Period | Alert Threshold              |
| ---------------------------- | ----------- | ------------------ | ---------------------------- |
| Message Delivery Rate        | 99.9%       | 24 hours           | < 99.5% for 5 minutes        |
| Message Latency (P95)        | < 3 seconds | 1 hour             | > 5 seconds for 5 minutes    |
| Service Availability         | 99.95%      | 30 days            | < 99.9% for 5 minutes        |
| Cross-Platform Compatibility | 99.5%       | 7 days             | < 99% for 10 minutes         |
| Agent Response Time          | < 2 seconds | 1 hour             | > 5 seconds for 3 minutes    |
| Test Suite Success Rate      | 98%         | 24 hours           | < 95% for 2 consecutive runs |

## Detailed SLO specifications

### Message delivery rate SLO

**Target**: 99.9% delivery rate over 24 hours

**Calculation**:

```typescript
const deliveryRate = (deliveredMessages / sentMessages) * 100;
const sloTarget = 99.9;
const isWithinSLO = deliveryRate >= sloTarget;
```

**Error Budget**:

- **Daily**: 0.1% of messages (approximately 144 failed messages per day at 100K messages/day)
- **Monthly**: 0.1% of messages over 30 days
- **Quarterly**: Annual error budget divided by 4

**Monitoring**:

```json
{
  "alert_name": "Message Delivery Rate SLO Violation",
  "query": "avg:xmtp.sdk.delivery{env:production} < 99.5",
  "threshold": 99.5,
  "evaluation_window": "5m",
  "notification_channels": ["#xmtp-qa-alerts", "pagerduty"]
}
```

### Message latency SLO

**Target**: 95th percentile < 3 seconds

**Latency Buckets**:

- **Excellent**: < 1 second (target for 50% of messages)
- **Good**: 1-3 seconds (acceptable for 45% of messages)
- **Acceptable**: 3-10 seconds (maximum for 4.9% of messages)
- **Poor**: > 10 seconds (maximum for 0.1% of messages)

**Geographic Targets**:
| Route | P95 Target | P99 Target |
|-------|------------|------------|
| Same Region | < 2 seconds | < 5 seconds |
| Cross-Region (US-EU) | < 3 seconds | < 8 seconds |
| Cross-Region (US-APAC) | < 5 seconds | < 12 seconds |
| Cross-Region (EU-APAC) | < 4 seconds | < 10 seconds |

### Cross-platform compatibility SLO

**Target**: 99.5% compatibility rate over 7 days

**SDK Combinations Monitored**:

```typescript
const sdkPairs = [
  { from: "browser-wasm", to: "node-napi" },
  { from: "node-napi", to: "react-native" },
  { from: "react-native", to: "browser-wasm" },
  { from: "swift-ffi", to: "kotlin-ffi" },
  // All possible combinations tracked
];
```

**Version Compatibility Matrix**:
| SDK Version | 2.0.x | 2.1.x | 2.2.x | 3.0.x |
|-------------|-------|-------|-------|-------|
| **2.0.x** | 100% | 99.9% | 99.5% | 95.0% |
| **2.1.x** | 99.9% | 100% | 99.9% | 99.0% |
| **2.2.x** | 99.5% | 99.9% | 100% | 99.5% |
| **3.0.x** | 95.0% | 99.0% | 99.5% | 100% |

### Service availability SLO

**Target**: 99.95% availability (maximum 21.6 minutes downtime per month)

**Availability Calculation**:

```typescript
const availability =
  ((totalTimeSeconds - downtimeSeconds) / totalTimeSeconds) * 100;

// Monthly availability target
const monthlyTarget = 99.95; // 21.6 minutes downtime allowed
const quarterlyTarget = 99.95; // 64.8 minutes downtime allowed
const annualTarget = 99.9; // 8.76 hours downtime allowed
```

**Downtime Categories**:

- **Planned Maintenance**: Scheduled, announced downtime (excluded from SLO)
- **Emergency Maintenance**: Unplanned but necessary downtime (counted)
- **Service Outage**: Unexpected service failures (counted)
- **Degraded Performance**: Service running but below performance SLOs (counted)

## Error budget management

### Error budget calculation

**Monthly Error Budget Example**:

```typescript
// For 99.9% availability SLO
const monthlyMinutes = 30 * 24 * 60; // 43,200 minutes
const availabilityTarget = 99.9; // 99.9%
const errorBudgetMinutes = (monthlyMinutes * (100 - availabilityTarget)) / 100;
// Error budget: 43.2 minutes per month
```

### Error budget policies

#### Budget consumption levels

**Level 1: Green (0-25% consumed)**

- Normal operations
- All feature releases allowed
- Standard monitoring

**Level 2: Yellow (25-50% consumed)**

- Increased monitoring
- Review release velocity
- Focus on reliability improvements

**Level 3: Orange (50-75% consumed)**

- Feature release freeze for affected services
- Mandatory reliability reviews
- Enhanced monitoring and alerting

**Level 4: Red (75-100% consumed)**

- Complete release freeze
- Emergency reliability focus
- Daily leadership review
- Postmortem required

### Error budget alerting

```json
{
  "alerts": [
    {
      "name": "Error Budget 50% Consumed",
      "threshold": 50,
      "notification": "#xmtp-qa-alerts"
    },
    {
      "name": "Error Budget 75% Consumed",
      "threshold": 75,
      "notification": ["#xmtp-qa-alerts", "engineering-leadership"]
    },
    {
      "name": "Error Budget Exhausted",
      "threshold": 100,
      "notification": ["#xmtp-qa-alerts", "pagerduty", "engineering-leadership"]
    }
  ]
}
```

## Monitoring and alerting

See [Monitoring system](./monitoring.md) for details.

### Alerting configuration

#### Multi-window alerts

```yaml
alerts:
  - name: "Message Delivery SLO Violation"
    conditions:
      short_window:
        duration: "5m"
        threshold: "< 99.5%"
        severity: "warning"
      long_window:
        duration: "30m"
        threshold: "< 99.7%"
        severity: "critical"

  - name: "Latency SLO Violation"
    conditions:
      short_window:
        duration: "5m"
        threshold: "> 5s"
        severity: "warning"
      long_window:
        duration: "15m"
        threshold: "> 3s"
        severity: "critical"
```

#### Escalation policy

1. **Initial Alert** (0-5 minutes):
   - Slack notification to #xmtp-qa-alerts
   - Automated runbook execution

2. **Escalation 1** (5-15 minutes):
   - Page on-call engineer
   - Slack notification to engineering team

3. **Escalation 2** (15-30 minutes):
   - Page engineering manager
   - Slack notification to leadership team

4. **Escalation 3** (30+ minutes):
   - Page director of engineering
   - Incident commander assignment

## SLO implementation examples

### Custom SLI implementation

```typescript
// Example: Custom group message delivery SLI
export class GroupDeliverySLI {
  async calculateSLI(timeWindow: TimeWindow): Promise<number> {
    const query = `sum:xmtp.group.messages.delivered{group_size:>10} / sum:xmtp.group.messages.sent{group_size:>10} * 100`;
    const result = await this.datadogClient.query(query, timeWindow);
    return result.value;
  }
}
```

### Alert definition

```yaml
# alerts/message-delivery-slo.yml
alerts:
  - name: "Message Delivery SLO Multi-Window"
    type: "slo_alert"
    slo_id: "message_delivery_rate"

    short_window:
      duration: "5m"
      burn_rate_threshold: 14.4 # 1% error budget in 1 hour

    long_window:
      duration: "1h"
      burn_rate_threshold: 2 # 5% error budget in 1 day

    notifications:
      - "#xmtp-qa-alerts"
      - "pagerduty:xmtp-oncall"
```
