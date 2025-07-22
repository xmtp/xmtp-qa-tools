# Incident response

Incident management procedures and escalation protocols for XMTP QA infrastructure and testing systems.

## Response team structure

### Primary contacts

| Role | Responsibility | Contact Method |
|------|---------------|----------------|
| QA Engineer | Test failures, SLO violations | #xmtp-qa-alerts |
| DevOps Engineer | Infrastructure issues | #xmtp-devops |
| On-call Engineer | Critical system failures | PagerDuty |

## Alerting channels

### Datadog integration

Automated monitoring triggers alerts based on metric thresholds:

```yaml
# Critical alert configuration
alert:
  name: "Message Delivery Rate Critical"
  query: "avg:xmtp.sdk.delivery{env:production} < 95"
  threshold: 95
  evaluation_window: "5m"
  escalation:
    - slack: "#xmtp-qa-alerts"
    - pagerduty: "xmtp-critical"
```

### PagerDuty escalation

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| Critical | 5 minutes | QA → DevOps → Engineering Manager |
| High | 15 minutes | QA → DevOps |
| Medium | 1 hour | QA team |
| Low | Next business day | QA team |

### Slack notifications

**#xmtp-qa-alerts**
- Test suite failures
- SLO violations
- Performance degradation

**#xmtp-devops**
- Infrastructure issues
- Deployment failures
- Resource constraints

## Incident classification

### Severity levels

**Critical (P0)**
- Production services down >99% failure rate
- Multiple test suites failing simultaneously
- Security incidents

**High (P1)**
- SLO violations affecting user experience
- Single test suite complete failure
- Infrastructure degradation

**Medium (P2)**
- Intermittent test failures
- Performance regression
- Non-critical service issues

**Low (P3)**
- Documentation issues
- Minor configuration problems
- Enhancement requests

## Response procedures

### Critical incident response

1. **Immediate action** (0-5 minutes)
   - Acknowledge alert in PagerDuty
   - Post status update in #xmtp-qa-alerts
   - Begin initial investigation

2. **Assessment** (5-15 minutes)
   - Determine impact scope
   - Identify affected services
   - Escalate if needed

3. **Mitigation** (15-60 minutes)
   - Implement immediate fixes
   - Activate backup systems if available
   - Communicate with stakeholders

### Incident.io integration

```bash
# Create incident via Slack
/incident create "Production delivery rate below 95%"

# Update incident status
/incident update "Investigating root cause"

# Resolve incident
/incident resolve "Fixed configuration issue"
```

## Monitoring dashboards

### Real-time status

- **Datadog Dashboard**: [XMTP SDK Performance](https://app.datadoghq.com/dashboard/your-dashboard-id)
- **Network Status**: [status.xmtp.org](https://status.xmtp.org/)
- **Railway Services**: [Railway Project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)

### Key metrics during incidents

| Metric | Critical Threshold | Dashboard Widget |
|--------|-------------------|------------------|
| Delivery Rate | <95% | Main performance |
| Response Time | >5000ms | Response times |
| Agent Uptime | <99% | Agent status |
| Test Success Rate | <90% | Test execution |

## Escalation matrix

### Automatic escalation triggers

```yaml
escalation_rules:
  - condition: "delivery_rate < 90% for 10 minutes"
    action: "page_engineering_manager"
  
  - condition: "test_failures > 5 consecutive"
    action: "escalate_to_devops"
  
  - condition: "infrastructure_down for 15 minutes"
    action: "page_director_engineering"
```

### Manual escalation

**When to escalate**
- Unable to resolve within SLA timeframe
- Issue affects multiple systems
- Requires architectural changes
- Security implications identified

## Post-incident procedures

### Incident review process

1. **Timeline creation** - Document incident progression
2. **Root cause analysis** - Identify underlying issues  
3. **Action items** - Define preventive measures
4. **Documentation update** - Update runbooks and procedures

### Postmortem template

```markdown
# Incident Postmortem: [Date] - [Title]

## Summary
Brief description of incident impact and resolution

## Timeline
- HH:MM - Issue detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Resolution implemented

## Root Cause
Technical explanation of underlying issue

## Action Items
- [ ] Immediate fixes
- [ ] Long-term improvements
- [ ] Process updates
```

## Runbooks

### Common scenarios

**Test suite failure**
```bash
# Check recent deployments
git log --oneline -10

# Review test logs
yarn test functional --debug

# Check infrastructure status
railway status --all
```

**Performance degradation**
```bash
# Check Datadog metrics
# Review dashboard for anomalies

# Validate network connectivity
yarn test network:health

# Check resource utilization
top -p $(pgrep node)
```

**Agent downtime**
```bash
# Test agent responsiveness
yarn test agents:health-check --all

# Check Railway service status
railway logs --service=agent-name

# Restart unresponsive agents
railway redeploy --service=agent-name
```

## Communication protocols

### Status updates

**Internal updates**
- Slack channels for technical details
- Incident.io for formal tracking
- Email for extended outages

**External communication**
- status.xmtp.org for public incidents
- Documentation updates for resolved issues
- Partner notifications for breaking changes

### Stakeholder notification

| Stakeholder | Notification Method | Update Frequency |
|-------------|-------------------|------------------|
| Engineering Team | Slack | Real-time |
| Product Team | Email | Hourly during incidents |
| Leadership | Email/Slack | Major incidents only |
| External Partners | Email | Service affecting only |
