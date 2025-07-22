# Dashboards

These are the dashboards we actually look at every day to understand how XMTP is performing. Think of them as our mission control - they show us everything we need to know about network health, delivery rates, and whether our users are having a good experience.

## What we've got set up

Our main dashboards cover:

- **Main Performance Dashboard**: Core XMTP SDK metrics and SLO tracking
- **Infrastructure Dashboard**: Service health and resource utilization
- **Test Execution Dashboard**: CI/CD pipeline and test suite performance
- **Regional Performance Dashboard**: Multi-region latency and delivery metrics

## Main performance dashboard

### How to get there

- **URL**: [Datadog XMTP Dashboard](https://app.datadoghq.com/dashboard/your-dashboard-id)
- **What you'll see**: XMTP SDK Performance - Metrics for SDK operations (DNS, TLS, Server Processing). See [monitoring system](./monitoring.md#monitoring-system) for related alerts.

### Key widgets

#### 1. Delivery rate (%)

**What it shows**: How many messages are actually making it to their destination across all our environments and regions.

```
Query: avg:xmtp.sdk.delivery{$env,$region,$test,$sdk,$members}
```

**Color coding**:

- Green (≥99%): Excellent performance, meeting SLO targets
- Yellow (≥95%): Acceptable performance, monitor closely
- Red (<95%): Below SLO threshold, immediate attention required

#### 2. Order rate (%)

**Purpose**: Measures message sequence integrity across different SDK bindings.

```
Query: avg:xmtp.sdk.order{$env,$region,$test,$sdk,$members}
```

#### 3. Latency metrics

**Purpose**: End-to-end message delivery timing across environments.

```
Query: avg:xmtp.sdk.latency{$env,$region,$test,$sdk}
```

#### 4. Cross-platform compatibility

**Purpose**: Success rates between different SDK implementations.

```
Query: avg:xmtp.sdk.compatibility{sdk_from:*,sdk_to:*}
```

### Dashboard variables

The dashboard supports filtering via template variables:

| Variable   | Description        | Example Values                           |
| ---------- | ------------------ | ---------------------------------------- |
| `$env`     | Environment filter | `dev`, `production`                      |
| `$region`  | Geographic region  | `us-east-1`, `eu-west-1`, `asia-pacific` |
| `$test`    | Test suite name    | `functional`, `performance`, `delivery`  |
| `$sdk`     | SDK version        | `2.0.0`, `2.1.0`, `2.2.0`                |
| `$members` | Group size         | `2`, `10`, `50`, `400`                   |

### Time range controls

- **Default**: Last 4 hours
- **Recommended**:
  - **Real-time monitoring**: Last 1 hour with auto-refresh (30s)
  - **Trend analysis**: Last 24 hours
  - **Weekly reviews**: Last 7 days

## Infrastructure dashboard

### Service health monitoring

#### Bot status widget

Tracks health of deployed testing bots:

```json
{
  "title": "Bot Response Times",
  "query": "avg:xmtp.bot.response_time{bot:*} by {bot}",
  "visualization": "timeseries"
}
```

#### Railway services

Monitors deployed services on Railway platform:

```json
{
  "title": "Railway Service Uptime",
  "query": "avg:railway.service.uptime{service:*} by {service}",
  "thresholds": {
    "critical": 95,
    "warning": 98
  }
}
```

### Resource utilization

#### Memory usage

```
Query: avg:system.mem.pct_usable{service:xmtp-*}
```

#### CPU utilization

```
Query: avg:system.cpu.user{service:xmtp-*}
```

## Test execution dashboard

### CI/CD pipeline health

#### Workflow success rates

Tracks GitHub Actions workflow performance:

```json
{
  "title": "Workflow Success Rate",
  "query": "sum:github.workflow.runs{status:success}/sum:github.workflow.runs{*}*100",
  "type": "query_value"
}
```

#### Test suite performance

Individual test suite execution metrics:

| Suite        | Frequency     | SLO Target  | Alert Threshold |
| ------------ | ------------- | ----------- | --------------- |
| Functional   | Every 3 hours | 98% success | <95% for 2 runs |
| Performance  | Every 30 min  | 95% success | <90% for 3 runs |
| Delivery     | Every 30 min  | 99% success | <95% for 2 runs |
| Large Groups | Every 2 hours | 90% success | <85% for 2 runs |
| Browser      | Every 30 min  | 95% success | <90% for 3 runs |
| Agents       | Every 15 min  | 99% success | <95% for 3 runs |

## Regional performance dashboard

### Multi-region latency

#### Geographic performance matrix

```json
{
  "title": "Cross-Region Latency",
  "query": "avg:xmtp.sdk.latency{*} by {region_from,region_to}",
  "visualization": "heatmap"
}
```

#### Regional load distribution

```json
{
  "title": "Message Volume by Region",
  "query": "sum:xmtp.sdk.messages.count{*} by {region}",
  "visualization": "pie_chart"
}
```

## How to read the dashboards

### Understanding SLO correlation

Each dashboard widget directly correlates to our defined SLOs:

1. **Green Status**: Performance exceeds SLO targets
   - Delivery Rate >99.9%
   - Response Time <2 seconds
   - Error Rate <0.1%

2. **Yellow Status**: Performance within acceptable range
   - Delivery Rate 95-99.8%
   - Response Time 2-5 seconds
   - Error Rate 0.1-1%

3. **Red Status**: Performance below SLO thresholds
   - Delivery Rate <95%
   - Response Time >5 seconds
   - Error Rate >1%

### Trend analysis

#### Identifying performance patterns

- **Daily Patterns**: Look for consistent dips during specific hours
- **Weekly Patterns**: Monitor weekend vs. weekday performance
- **Release Correlation**: Compare metrics before/after deployments

#### Anomaly detection

The dashboards include automatic anomaly detection:

- **Outlier Detection**: Flags unusual spikes or drops
- **Trend Deviation**: Alerts when metrics deviate from historical trends
- **Seasonal Adjustments**: Accounts for expected variations

## Dashboard alerts

### Alert configuration

Alerts are configured to trigger notifications in Slack channels:

```json
{
  "alert_conditions": [
    {
      "metric": "xmtp.sdk.delivery",
      "threshold": 95,
      "comparison": "below",
      "duration": "5m",
      "channel": "#xmtp-qa-alerts"
    }
  ]
}
```

### Alert escalation

1. **Immediate Slack Notification**: First threshold breach
2. **Escalated Alert**: Continued degradation for >15 minutes
3. **On-Call Page**: Critical service impact lasting >30 minutes

## Custom dashboard creation

### Creating new widgets

To add custom monitoring for new features:

1. **Define Metrics**: Use consistent naming convention (`xmtp.component.metric`)
2. **Set Thresholds**: Align with existing SLO framework
3. **Configure Alerts**: Follow escalation patterns
4. **Document**: Update this documentation

### Widget templates

#### Basic metric widget

```json
{
  "id": "custom_widget_id",
  "definition": {
    "title": "Custom Metric",
    "type": "query_value",
    "requests": [
      {
        "queries": [
          {
            "query": "avg:xmtp.custom.metric{$env}",
            "data_source": "metrics"
          }
        ]
      }
    ],
    "conditional_formats": [
      { "comparator": ">=", "value": 95, "palette": "white_on_green" },
      { "comparator": "<", "value": 95, "palette": "white_on_red" }
    ]
  }
}
```

## Dashboard maintenance

### Regular reviews

**Weekly Dashboard Review**:

- Verify all widgets are displaying data correctly
- Check for outdated or unused widgets
- Update thresholds based on performance trends
- Review and adjust alert configurations

**Monthly Dashboard Optimization**:

- Analyze dashboard usage patterns
- Remove or consolidate underutilized widgets
- Update color schemes and thresholds
- Gather team feedback for improvements

### Best practices

1. **Keep It Simple**: Focus on actionable metrics
2. **Consistent Layout**: Follow established visual patterns
3. **Meaningful Names**: Use descriptive widget titles
4. **Proper Scaling**: Ensure Y-axis scales are appropriate
5. **Color Consistency**: Use standard color palette for status

## Access and permissions

### Team access

- **QA Team**: Full dashboard access and edit permissions
- **Engineering Team**: Read access to performance dashboards
- **DevOps Team**: Full access to infrastructure dashboards
- **Management**: Read access to summary dashboards

### External access

- **Public Status**: Limited metrics available at [status.xmtp.org](https://status.xmtp.org/)
- **Partner Access**: Restricted dashboard views for integration partners
- **Incident Response**: Temporary elevated access during outages
