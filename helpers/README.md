# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test workers, collecting metrics, and validating test results.

## Quick reference

| Module                     | Purpose                          | Key Features                                     |
| -------------------------- | -------------------------------- | ------------------------------------------------ |
| **client.ts**              | XMTP client creation             | Signers, encryption keys, client versioning      |
| **datadog.ts**             | Metrics and monitoring           | Performance tracking, test results reporting     |
| **groups.ts**              | Group conversation management    | Group creation, batch operations, stress testing |
| **logger.ts**              | Logging utilities                | Formatted logging, file output, error tracking   |
| **playwright.ts**          | Browser automation               | UI testing, group creation, message verification |
| **streams.ts**             | Message streaming utilities      | Stream verification, message delivery testing    |
| **tests.ts**               | Test configuration and utilities | Test setup, SDK version management               |
| **generated-inboxes.json** | Pre-generated test identities    | Test account data for simulations                |
| **slack.ts**               | Slack notification utilities     | Send notifications to Slack channels             |
| **ai.ts**                  | OpenAI API utilities             | Generate OpenAI responses                        |

## Usage

The helper modules are designed to be imported and used in test suites:

```typescript
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { sendPerformanceResult } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyMessageStream, verifyMessageStreamAll } from "@helpers/streams";
```

## 🔑 Client Module

The `client.ts` module provides utilities for creating and managing XMTP clients.

```typescript
// Create a signer for an XMTP client
const signer = createSigner(WALLET_KEY);

// Generate an encryption key
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Load environment configuration for tests
loadEnv(testName);

// Create an XMTP client with specific version
const client = await createClient(
  walletKey,
  encryptionKeyHex,
  { sdkVersion, name, testName, folder },
  xmtpEnv,
);
```

**Key features:**

- Signer creation for different SDK versions
- Encryption key management
- Database path handling
- Environment configuration loading

## 📊 Datadog Module

The `datadog.ts` module provides utilities for sending metrics and test results to Datadog.

```typescript
// Initialize Datadog metrics
initDataDog(testName, envValue, geolocation, apiKey);

// Send performance metrics
sendPerformanceResult(expect, workers, start);
```

### Schema for Datadog metrics:

```bash

- `timestamp`: string, ISO8601 or log timestamp
- `level`: string, log level (e.g., debug, info)
- `metric_name`: string, the metric name (e.g., xmtp.sdk.duration)
- `metric_value`: number, the value of the metric
- `tags`: object, key-value pairs with additional context, including:
  - `libxmtp`: string or number
  - `operation`: string
  - `test`: string
  - `metric_type`: string
  - `metric_subtype`: string
  - `description`: string
  - `members`: string or number
  - `region`: string
  - `env`: string
  - `vm`: string
  - `network_phase`: string (optional, for network metrics)
  - `country_iso_code`: string (optional, for network metrics)
  - ...any other key:value pairs present in the tags
```

**Key features:**

- Performance metric tracking
- Test result reporting
- Network statistics
- Operation thresholds based on group size

## 👥 Groups Module

The `groups.ts` module provides utilities for creating and managing test groups.

```typescript
// Create a group with participants in batches
const result = await createGroupWithBatch(
  creator,
  allWorkers,
  batchSize,
  installationsPerUser,
);

// Get workers that are members of a group
const groupMembers = await getWorkersFromGroup(group, workers);

// Create a large test group with many members
const largeGroup = await createLargeGroup(client, memberCount, receiverInboxId);
```

**Key features:**

- Batch member addition
- Performance measurement for group operations
- Large group creation utilities
- Stress testing configurations

## 📝 Logger Module

The `logger.ts` module provides logging utilities with formatting and file output.

```typescript
// Create a formatted logger
const logger = createLogger();

// Set up pretty console log formatting
setupPrettyLogs();

// Log test errors and track failures
const logError(error, expect);

// Add file logging capability
addFileLogging(filename);
```

**Key features:**

- Formatted console logging
- File output for logs
- Error tracking for test failures
- Performance timing utilities

## 🌐 Playwright Module

The `playwright.ts` module provides browser automation for testing XMTP in web applications.

```typescript
// Create a new Playwright instance
const xmtpPlaywright = new XmtpPlaywright(headless, env);

// Create a group and check for response
await xmtpPlaywright.createGroupAndReceiveGm(addresses);
```

**Key features:**

- Headless browser testing
- Group creation through UI
- Message verification
- Screenshot capabilities

## 🔄 Streams Module

The `streams.ts` module provides utilities for testing message delivery through streams.

```typescript
// Verify that all participants in a group receive messages
const result = await verifyMessageStreamAll(group, workers, messageCount);

// Verify message delivery with custom settings
const result = await verifyMessageStream(
  group,
  participants,
  contentType,
  messageCount,
);

// Verify conversation events are received by participants
const result = await verifyConversationStream(initiator, participants);
```

**Key features:**

- Message delivery verification
- Stream testing for different content types
- Group update notifications
- Performance metrics for message delivery

## 🧪 Tests Module

The `tests.ts` module provides test configuration and utilities.

```typescript
// Access SDK version configurations
const sdkVersion = sdkVersions[200];

// Default test values
const { streamTimeout, messageCount } = defaultValues;
```

**Key features:**

- SDK version management
- Test configuration
- Test data generation
- Default test parameters

## 📁 Data Files

### generated-inboxes.json

Pre-generated XMTP identities for testing.

**Features:**

- Account addresses
- Private keys
- Encryption keys
- Inbox IDs

### oldpackages.json

Configuration for legacy package versions.

**Features:**

- Package name mappings
- Version information
- Dependency configurations

## 🔍 Module Details

### streams.ts

Handles stream utilities for testing message delivery:

```typescript
// Verify that all participants in a group receive messages
const result = await verifyMessageStreamAll(group, workers, messageCount);

// Verify message delivery with custom settings
const result = await verifyMessageStream(
  group,
  participants,
  contentType,
  messageCount,
  messageGenerator,
  messageSender,
);

// Verify conversation events are received by participants
const result = await verifyConversationStream(initiator, participants);

// Calculate statistics about message delivery
const stats = calculateMessageStats(
  messagesByWorker,
  messagePrefix,
  messageCount,
  suffix,
);
```

### tests.ts

Handles test configuration and setup:

```typescript
// Create a test configuration
const testConfig = createTestConfig(testName, workerConfigs);
```

### client.ts

Handles XMTP client creation and version mappings:

### datadog.ts

Utilities for sending metrics to Datadog:

```typescript
// Send a metric to Datadog
sendMetric(metricName, metricValue, tags);

// Send a performance metric to Datadog
sendPerformanceMetric(metricValue, testName, libXmtpVersion, skipNetworkStats);
```

### groups.ts

Utilities for creating and managing test groups:

```typescript
// Create a group with a specific number of participants
const result = await createGroupWithBatch(
  creator,
  allWorkers,
  batchSize,
  installationsPerUser,
);
```

### logger.ts

Provides logging capabilities for tests:

```typescript
// Create a logger for a specific test
const logger = createLogger(testName);

// Override console methods to use the logger
overrideConsole(logger);

// Flush logs to disk when test completes
flushLogger(testName);
```

### playwright.ts

Utilities for testing message delivery using Playwright:

```typescript
// Initialize Playwright browser
const browser = await playwright.launch({ headless: true });

// Create a new page
const page = await browser.newPage();

// Navigate to a specific URL
await page.goto("https://xmtp.chat");

// Close the browser
await browser.close();
```
