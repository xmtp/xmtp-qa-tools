# XMTP QA Tools Documentation

Hey everyone, this is our comprehensive testing setup for XMTP. We've built a pretty robust suite of automated tools that validate network performance, message delivery, and protocol correctness across all our environments.

## Quick navigation

### Core systems
- [Monitoring system](./monitoring.md) - Metrics tracking, Slack integration, and alerting
- [Dashboards](./dashboards.md) - Datadog dashboards and visualization guides
- [Test suites](./test-suites.md) - Comprehensive overview of all automated test suites
- [Workflows](./workflows.md) - GitHub Actions CI/CD automation and deployment

### Performance and reliability
- [SLOs and SLIs](./slos-slis.md) - Service Level Objectives and performance targets
- [Scaling limitations](./scaling-limitations.md) - Current constraints and optimization opportunities
- [Streams](./streams.md) - Message streaming reliability, order validation, and response time testing

### Specialized testing
- [Agents QA](./agents-qa.md) - Agent and bot testing framework
- [Forks](./forks.md) - Protocol fork testing and version compatibility
- [Incident response](./incident-response.md) - Incident management and escalation procedures



## What we're testing

We run automated workflows every 30 minutes that cover the core areas that matter:

### Testing framework
We've got 8 automated test suites running continuously. These hit all the critical paths - Browser SDK, Node SDK, React Native, Swift, and Kotlin bindings. We can scale test up to 400-member groups and use Playwright for real browser testing. Plus we monitor all our deployed bots to make sure they're responding.

### Monitoring and observability  
Everything feeds into Datadog with custom dashboards. Slack gets automated alerts when things break. We track a 99.9% delivery rate target and have error budgets that tell us when we're burning through our reliability allowance too fast. We test across multiple regions so we catch geographic issues.

### Infrastructure and automation
GitHub Actions runs everything on a schedule that doesn't overwhelm our systems. Railway hosts our bots. We test against dev, production, and local environments. The benchmarking is automated so we catch performance regressions before they become problems.

## Getting started

### For new team members
1. Review [Test suites](./test-suites.md) for testing approach
2. Study [Monitoring system](./monitoring.md) for observability concepts
3. Explore [Dashboards](./dashboards.md) for metrics visualization
4. Check [Workflows](./workflows.md) for CI/CD automation

### For contributors
1. Understand [SLOs and SLIs](./slos-slis.md) performance standards
2. Review [Scaling limitations](./scaling-limitations.md) current constraints
3. Follow [Workflows](./workflows.md) guidelines

### For operators
1. Master [Monitoring system](./monitoring.md) for daily operations
2. Use [Dashboards](./dashboards.md) for real-time system health
3. Reference [SLOs and SLIs](./slos-slis.md) for incident response
4. Review [Incident response](./incident-response.md) for escalation procedures

## Key metrics and targets

These are the numbers we actually care about hitting:

### Core SLOs
| Metric | Target | Environment |
|--------|--------|-------------|
| Message delivery rate | 99.9% | Production |
| Message latency (P95) | <3 seconds | Production |
| Service availability | 99.95% | Production |
| Cross-platform compatibility | 99.5% | All environments |
| Large group performance | 95% delivery for 400 members | All environments |

### Test suite coverage
The automated workflows run on these schedules:
- Functional tests: Core protocol validation every 3 hours
- Performance tests: Benchmarking every 30 minutes  
- Delivery tests: Cross-environment reliability every 30 minutes
- Browser tests: Web environment validation every 30 minutes
- Agent tests: Bot health monitoring every 15 minutes
- Large group tests: Scale testing every 2 hours

## How this all fits together

We test the entire XMTP protocol stack from top to bottom:

```
Applications (xmtp.chat, Convos, Agents)
    ↕
SDKs (Browser WASM, Node Napi, React Native, Swift FFI, Kotlin FFI)
    ↕
LibXMTP (Rust core with openmls and diesel)
    ↕
Decentralized Nodes (XMTP Network)
```

What we're validating:
- All the SDK bindings can talk to each other
- Everything works reliably across dev and production  
- Performance holds up at enterprise scale
- Real browsers and mobile apps actually work

## Support and contact

### For issues
- Immediate support: #xmtp-qa-alerts Slack channel
- Bug reports: GitHub issues in [xmtp-qa-tools repository](https://github.com/xmtp/xmtp-qa-tools)
- Documentation updates: Create pull requests with improvements

### For questions
- Technical questions: Engineering team via Slack
- Process questions: QA team via Slack  
- Monitoring issues: DevOps team or Datadog support

### External resources
- Network status: [status.xmtp.org](https://status.xmtp.org/)
- Performance dashboard: [Datadog XMTP Dashboard](https://app.datadoghq.com/dashboard/your-dashboard-id)
- Railway services: [Railway Project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- GitHub Actions: [Scheduled workflows](https://github.com/xmtp/xmtp-qa-tools/actions?query=event:schedule)

## Documentation maintenance

This documentation is actively maintained by the QA team. Updates are made:
- **Weekly**: Performance metrics and SLO status updates
- **Monthly**: Architecture and process improvements
- **Quarterly**: Strategic roadmap and enhancement planning

Last updated: January 2024