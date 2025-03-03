# GitHub workflows documentation

This document provides practical instructions for using the GitHub workflows in the `/.github/workflows` directory.

## TS_GM_bot workflow

The `TS_GM_bot.yml` workflow automates testing of the GM bot functionality.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_GM_bot > Run workflow
```

**Expected result:** The workflow will run tests against the GM bot functionality, verifying message sending and receiving capabilities.

## TS_Loss workflow

The `TS_Loss.yml` workflow tests message delivery reliability and identifies potential message loss.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Loss > Run workflow
```

**Expected result:** The workflow will generate test messages and verify their delivery, reporting any message loss detected.

## TS_Performance workflow

The `TS_Performance.yml` workflow measures and reports on XMTP network performance metrics.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Performance > Run workflow
```

**Expected result:** The workflow will run performance tests and generate metrics on message delivery times, throughput, and other performance indicators.

## TS_Streams workflow

The `TS_Streams.yml` workflow tests the XMTP streams functionality.

```bash
# Manually trigger the workflow from GitHub Actions UI
# Navigate to: Actions > TS_Streams > Run workflow
```

**Expected result:** The workflow will verify that message streams are working correctly, testing subscription, real-time updates, and stream reliability.
