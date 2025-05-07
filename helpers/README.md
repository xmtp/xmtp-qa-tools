# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test workers, collecting metrics, and validating test results.

## Quick reference

| Module                       | Purpose                           | Key Features                                     |
| ---------------------------- | --------------------------------- | ------------------------------------------------ |
| **client.ts**                | XMTP client creation              | Signers, encryption keys, client versioning      |
| **datadog.ts**               | Metrics and monitoring            | Performance tracking, test results reporting     |
| **groups.ts**                | Group conversation management     | Group creation, batch operations, stress testing |
| **logger.ts**                | Logging utilities                 | Formatted logging, file output, error tracking   |
| **playwright.ts**            | Browser automation                | UI testing, group creation, message verification |
| **railway.ts**               | Railway deployment management     | Fetch/redeploy Railway deployments               |
| **streams.ts**               | Message streaming utilities       | Stream verification, message delivery testing    |
| **tests.ts**                 | Test configuration and utilities  | Test setup, SDK version management               |
| **generated-inboxes.json**   | Pre-generated test identities     | Test account data for simulations                |
| **oldpackages.json**         | Legacy package configurations     | Compatibility testing data                       |
| **slack.ts**                 | Slack notification utilities      | Send notifications to Slack channels             |
| **datadog-performance.json** | Performance metrics configuration | Thresholds and expectations for tests            |
| **ai.ts**                    | OpenAI API utilities              | Generate OpenAI responses                        |

## Usage

The helper modules are designed to be imported and used in test suites:

```typescript
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { sendPerformanceResult, sendTestResults } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyStream, verifyStreamAll } from "@helpers/streams";
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

// Send test results to Datadog
sendTestResults(hasFailures, testName);

// Send performance metrics
sendPerformanceResult(expect, workers, start);
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
const hasFailures = logError(error, expect);

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

## 🚅 Railway Module

The `railway.ts` module provides utilities for managing Railway deployments.

```typescript
// Get the latest deployment
const deployment = await getLatestDeployment();

// Redeploy a deployment
const redeployedDeployment = await redeployDeployment(deploymentId);
```

**Key features:**

- Fetch latest deployment information
- Trigger redeployments
- Access to deployment URLs

## 🔄 Streams Module

The `streams.ts` module provides utilities for testing message delivery through streams.

```typescript
// Verify that all participants in a group receive messages
const result = await verifyStreamAll(group, workers, messageCount);

// Verify message delivery with custom settings
const result = await verifyStream(
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

### datadog-performance.json

Performance metric thresholds and expectations.

**Features:**

- Operation thresholds
- Network metrics
- Regional multipliers
- Group size thresholds

## 📝 Best practices

When using these helper modules, consider the following best practices:

1. **Version management:** Always use the appropriate SDK version for your test
2. **Error handling:** Properly catch and log errors using the provided utilities
3. **Resource cleanup:** Close clients and clean up resources after tests
4. **Metrics:** Use the datadog module to track performance metrics
5. **Logging:** Enable appropriate logging for debugging issues

## 📋 Core Modules

| Module                         | Purpose                                           |
| ------------------------------ | ------------------------------------------------- |
| [client.ts](#clientts)         | Creates signers and manages keys for test workers |
| [groups.ts](#groupsts)         | Creates test groups with specified participants   |
| [streams.ts](#streamsts)       | Streams utilities for testing message delivery    |
| [logger.ts](#loggerts)         | Logging utilities for test output                 |
| [tests.ts](#testts)            | Test utilities for creating and managing tests    |
| [datadog.ts](#datadogts)       | Datadog utilities for testing message delivery    |
| [railway.ts](#railwayts)       | Railway utilities for testing message delivery    |
| [playwright.ts](#playwrightts) | Playwright utilities for testing message delivery |

## 🔍 Module Details

### streams.ts

Handles stream utilities for testing message delivery:

```typescript
// Verify that all participants in a group receive messages
const result = await verifyStreamAll(group, workers, messageCount);

// Verify message delivery with custom settings
const result = await verifyStream(
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

// Send a test result to Datadog
sendTestResults(hasFailures, testName);

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

### railway.ts

The `helpers/railway.ts` module provides utility functions for interacting with Railway deployments:

### getLatestDeployment()

Fetches the most recent deployment for your Railway service using the Railway GraphQL API.

```typescript
import { getLatestDeployment } from "./helpers/railway";

// Get the latest deployment information
const deployment = await getLatestDeployment();
console.log(`Latest deployment ID: ${deployment.id}`);
console.log(`Static URL: ${deployment.staticUrl}`);
```

### redeployDeployment(deploymentId)

Triggers a redeployment of a specific deployment using the Railway GraphQL API.

```typescript
import { getLatestDeployment, redeployDeployment } from "./helpers/railway";

// Get the latest deployment and then redeploy it
const latestDeployment = await getLatestDeployment();
const redeployedDeployment = await redeployDeployment(latestDeployment.id);

console.log(`Redeployed deployment status: ${redeployedDeployment.status}`);
```

### Required environment variables

To use these functions, you need to set the following environment variables:

- `RAILWAY_SERVICE_ID`: The ID of your Railway service
- `RAILWAY_API_TOKEN`: Your Railway API token
- `RAILWAY_PROJECT_ID`: Your Railway project ID
- `RAILWAY_ENVIRONMENT_ID`: Your Railway environment ID
