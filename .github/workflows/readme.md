# 🔄 GitHub Workflows Documentation

This document provides practical instructions for using the GitHub workflows in the `/.github/workflows` directory.

## Workflow Overview

| Workflow           | Schedule     | Purpose                                                | Key Features                   |
| ------------------ | ------------ | ------------------------------------------------------ | ------------------------------ |
| **TS_Gm**          | Every 30 min | Tests GM bot functionality                             | Message exchange validation    |
| **TS_Delivery**    | Every 40 min | Tests message reliability across 200 streams           | High-volume delivery testing   |
| **TS_Performance** | Every 30 min | Measures XMTP network performance                      | Performance metrics collection |
| **TS_Geolocation** | Every 32 min | Measures geolocation of the library in the dev network | Geolocation metrics collection |

## 🤖 TS_Gm Workflow

The `TS_Gm.yml` workflow automates testing of the GM bot functionality, ensuring reliable message exchange with the XMTP network.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Gm > Run workflow
```

**Expected Result:** The workflow will run tests against the GM bot functionality, verifying message sending and receiving capabilities.

### Technical Details:

- ⏱️ Runs every 30 minutes via cron schedule
- 🔄 Uses retry mechanism (up to 3 attempts) for test stability
- 📊 Reports test results to Datadog for monitoring
- 🧪 Tests against the configured GM bot address in the Dev environment

## 📨 TS_Delivery Workflow

The `TS_Delivery.yml` workflow tests message delivery reliability across 200 concurrent streams, identifying potential message loss in high-volume scenarios.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Delivery > Run workflow
```

**Expected Result:** The workflow will generate test messages and verify their delivery, reporting any message loss detected.

### Technical Details:

- ⏱️ Runs every 40 minutes via cron schedule
- 🔧 Configures system resources for optimal SQLCipher performance
- 🔍 Uses sophisticated error filtering to handle common transient issues
- 🔄 Implements retry logic (up to 3 attempts) for test stability
- 📊 Sends detailed metrics to Datadog for performance tracking
- ⚙️ Configurable message volume via environment variables

## ⚡ TS_Performance Workflow

The `TS_Performance.yml` workflow measures and reports on XMTP network performance metrics, providing insights into system scalability and responsiveness.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Performance > Run workflow
```

**Expected Result:** The workflow will run performance tests and generate metrics on message delivery times, throughput, and other performance indicators.

### Technical Details:

- ⏱️ Runs every 30 minutes via cron schedule
- ⚙️ Configurable batch size and group size parameters
- 🔄 Implements retry mechanism for test stability
- 📊 Reports comprehensive performance metrics to Datadog
- 👁️ Provides real-time visibility into XMTP network performance

## 📊 TS_Geolocation Workflow

The `TS_Geolocation.yml` workflow measures geolocation of the library in the dev network, providing insights into the library's performance and reliability.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Geolocation > Run workflow
```

**Expected Result:** The workflow will run geolocation tests and generate metrics on the library's performance and reliability.

### Technical Details:

- ⏱️ Runs every 32 minutes via cron schedule
- 📊 Reports geolocation metrics to Datadog for monitoring

## 📊 Monitoring and Observability

All workflows include integrated Datadog reporting that:

- 📝 Sends workflow status events with detailed context
- 📈 Tracks success/failure metrics for monitoring
- 🏷️ Tags data with repository, branch, and trigger information
- 🔗 Provides links to GitHub workflow runs for easy debugging
- 🚨 Enables alerting on workflow failures

These automated tests form a critical part of XMTP's continuous monitoring system, ensuring network reliability and performance for all developers building on the protocol.
