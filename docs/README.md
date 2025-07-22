# XMTP QA Tools Documentation

Welcome to the comprehensive documentation for the XMTP QA Tools monorepo. This documentation provides detailed information about our testing infrastructure, monitoring systems, workflows, and operational procedures.

## Quick Navigation

### 🏗️ Core Systems
- **[Monitoring System](./monitoring.md)** - Metrics tracking, Slack integration, and alerting
- **[Dashboards](./dashboards.md)** - Datadog dashboards and visualization guides
- **[Test Suites](./test-suites.md)** - Comprehensive overview of all automated test suites
- **[Workflows](./workflows.md)** - GitHub Actions CI/CD automation and deployment

### 📊 Performance & Reliability
- **[SLOs and SLIs](./slos-slis.md)** - Service Level Objectives and performance targets
- **[Scaling Limitations](./scaling-limitations.md)** - Current constraints and optimization opportunities

### 🚀 Future Planning
- **[Future Enhancements](./future-enhancements.md)** - Roadmap and planned improvements

## Documentation Overview

This documentation covers the comprehensive testing and monitoring infrastructure for the XMTP protocol, including:

### Testing Framework
- **8 Automated Test Suites** running continuously across multiple environments
- **Cross-Platform Validation** for Browser, Node, React Native, Swift, and Kotlin SDKs
- **Scale Testing** up to 400-member groups with performance benchmarking
- **Browser Automation** using Playwright for real-world web testing
- **Agent Health Monitoring** for deployed bots and automation services

### Monitoring & Observability
- **Real-Time Metrics** collected via Datadog with custom dashboards
- **Slack Integration** for automated alerting and team notifications
- **SLO Tracking** with 99.9% delivery rate targets and error budget management
- **Multi-Region Performance** monitoring across US, EU, and Asia-Pacific regions

### Infrastructure & Automation
- **GitHub Actions Workflows** with staggered execution to prevent resource contention
- **Railway Deployments** for bot hosting and service management
- **Multi-Environment Testing** across `dev`, `production`, and local environments
- **Automated Benchmarking** with performance regression detection

## Getting Started

### For New Team Members
1. Start with [Test Suites](./test-suites.md) to understand our testing approach
2. Review [Monitoring System](./monitoring.md) for observability concepts
3. Explore [Dashboards](./dashboards.md) to learn about our metrics visualization
4. Check [Workflows](./workflows.md) for CI/CD automation details

### For Contributors
1. Understand our [SLOs and SLIs](./slos-slis.md) for performance standards
2. Review [Scaling Limitations](./scaling-limitations.md) for current constraints
3. Check [Future Enhancements](./future-enhancements.md) for planned improvements
4. Follow workflow guidelines in [Workflows](./workflows.md)

### For Operators
1. Master the [Monitoring System](./monitoring.md) for daily operations
2. Use [Dashboards](./dashboards.md) for real-time system health
3. Reference [SLOs and SLIs](./slos-slis.md) for incident response
4. Check [Scaling Limitations](./scaling-limitations.md) for capacity planning

## Key Metrics & Targets

### Core SLOs
| Metric | Target | Environment |
|--------|--------|-------------|
| **Message Delivery Rate** | 99.9% | Production |
| **Message Latency (P95)** | <3 seconds | Production |
| **Service Availability** | 99.95% | Production |
| **Cross-Platform Compatibility** | 99.5% | All environments |
| **Large Group Performance** | 95% delivery for 400 members | All environments |

### Test Suite Coverage
- **Functional Tests**: Core protocol validation every 3 hours
- **Performance Tests**: Benchmarking every 30 minutes  
- **Delivery Tests**: Cross-environment reliability every 30 minutes
- **Browser Tests**: Web environment validation every 30 minutes
- **Agent Tests**: Bot health monitoring every 15 minutes
- **Large Group Tests**: Scale testing every 2 hours

## Architecture Overview

The XMTP QA Tools testing framework validates the entire XMTP protocol stack:

```
📱 Applications (xmtp.chat, Convos, Agents)
    ↕️
🔧 SDKs (Browser WASM, Node Napi, React Native, Swift FFI, Kotlin FFI)
    ↕️
⚡ LibXMTP (Rust core with openmls and diesel)
    ↕️
🌐 Decentralized Nodes (XMTP Network)
```

Our testing ensures:
- **Cross-Platform Compatibility** between all SDK bindings
- **Protocol Reliability** across different environments
- **Performance Standards** for enterprise-scale usage
- **Real-World Validation** through browser and mobile testing

## Support & Contact

### For Issues
- **Immediate Support**: #xmtp-qa-alerts Slack channel
- **Bug Reports**: GitHub issues in [xmtp-qa-tools repository](https://github.com/xmtp/xmtp-qa-tools)
- **Documentation Updates**: Create pull requests with improvements

### For Questions
- **Technical Questions**: Engineering team via Slack
- **Process Questions**: QA team via Slack  
- **Monitoring Issues**: DevOps team or Datadog support

### External Resources
- **Network Status**: [status.xmtp.org](https://status.xmtp.org/)
- **Performance Dashboard**: [Datadog XMTP Dashboard](https://app.datadoghq.com/dashboard/your-dashboard-id)
- **Railway Services**: [Railway Project](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- **GitHub Actions**: [Scheduled Workflows](https://github.com/xmtp/xmtp-qa-tools/actions?query=event:schedule)

## Documentation Maintenance

This documentation is actively maintained by the QA team. Updates are made:
- **Weekly**: Performance metrics and SLO status updates
- **Monthly**: Architecture and process improvements
- **Quarterly**: Strategic roadmap and enhancement planning

Last updated: January 2024