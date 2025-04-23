# XMTP Test Suites Documentation

This document provides a comprehensive overview of the XMTP testing infrastructure, organized by test suites and their monitoring dashboards.

## Table of Contents

- [TS_Performance Test Suite](#ts_performance-test-suite)
- [TS_Delivery Test Suite](#ts_delivery-test-suite)
- [TS_Gm Test Suite](#ts_gm-test-suite)
- [TS_Fork Test Suite](#ts_fork-test-suite)

## TS_Performance Test Suite

The TS_Performance test suite comprehensively measures XMTP network performance across various operations, providing critical insights into system scalability and responsiveness.

### Key Features

- Measures client creation performance
- Tests inbox state retrieval speeds
- Evaluates DM creation and communication latency
- Tests group operations with configurable sizes
- Measures group synchronization efficiency
- Evaluates group update performance

### Configuration

```javascript
// Configuration parameters
const batchSize = parseInt(
  process.env.CLI_BATCH_SIZE ?? process.env.BATCH_SIZE ?? "5",
);
const total = parseInt(
  process.env.CLI_GROUP_SIZE ?? process.env.MAX_GROUP_SIZE ?? "10",
);
```

### Associated Workflow

The [`TS_Performance.yml`](/.github/workflows/TS_Performance.yml) workflow automates this test suite:

- Runs every 15 minutes
- Supports configurable batch and group sizes
- Implements retry logic for stability
- Reports comprehensive metrics to Datadog

Regional testing is available via the [`TS_Geolocation.yml`](/.github/workflows/TS_Geolocation.yml) workflow.

### Monitoring

Performance metrics feed into the [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/), which visualizes operation durations, network performance, and scalability indicators.

## TS_Delivery Test Suite

The TS_Delivery test suite rigorously evaluates message delivery reliability across multiple streams, ensuring messages are delivered correctly and in order under varying conditions.

### Key Features

- Tests message delivery in streaming mode
- Verifies message ordering
- Tests message delivery via polling
- Evaluates offline recovery scenarios
- Configurable message volume and receiver count

### Configuration

```javascript
// Configuration parameters
const amountofMessages = parseInt(
  process.env.CLI_DELIVERY_AMOUNT ?? process.env.DELIVERY_AMOUNT ?? "10",
);
const receiverAmount = parseInt(
  process.env.CLI_DELIVERY_RECEIVERS ?? process.env.DELIVERY_RECEIVERS ?? "4",
);
```

### Associated Workflow

The [`TS_Delivery.yml`](/.github/workflows/TS_Delivery.yml) workflow automates this test suite:

- Runs every 30 minutes
- Optimizes system resources for SQLCipher performance
- Implements retry logic (up to 3 attempts) for stability
- Reports delivery reliability metrics to Datadog

## TS_Gm Test Suite

The TS_Gm test suite serves as a critical regression testing tool by verifying the GM bot functionality across different SDK versions, ensuring backward compatibility and reliable messaging capabilities.

### Key Features

- Tests direct messaging with the GM bot
- Verifies group messaging functionality
- Uses hybrid approach with SDK integration and browser automation
- Tests cross-version compatibility

### Associated Workflow

The [`TS_Gm.yml`](/.github/workflows/TS_Gm.yml) workflow automates this test suite:

- Runs every 30 minutes
- Tests against both Dev and Production environments
- Includes Playwright-based browser automation tests
- Reports results to Datadog for monitoring

## TS_Fork Test Suite

The TS_Fork test suite reproduces and investigates group conversation forking issues by simulating high-frequency membership changes and message exchanges.

### Key Features

- Simulates high-frequency membership changes
- Tests with mixed client types (10 programmatic + 4 manual)
- Performs multiple add/remove cycles
- Records performance metrics for operations

### Test Environment

- **Client Mix**: 10 programmatic workers + 4 manual clients
- **Applications**: Convos.io, Convos Desktop, XMTP Chat Web, Coinbase Wallet iOS

### Setup

```bash
git clone https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

### Configuration

Create a `.env` file in the `bugs/bug_fork` directory with appropriate credentials.

### Running the Tests

```bash
yarn test fork
```

### Test Flow

1. Group creation and initialization
2. Fork detection with targeted messages
3. Message exchange between workers
4. Membership cycling (remove → add → sync)

### Results Analysis

Tests identify correlations between forking issues and client creation intervals, providing insights into synchronization vulnerabilities.

## Running Tests

To run any test suite:

```bash
# Install dependencies
yarn install

# Run a specific test suite
yarn test <suite-name>

# Example: Run the performance test suite
yarn test performance
```

For additional configuration options, refer to the specific test suite documentation.
