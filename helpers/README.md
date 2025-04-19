# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test workers, collecting metrics, and validating test results.

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

```typescript
// SDK version mappings
export const sdkVersions = {
  47: {},
  105: {},
  202: {},
  203: {},
};
```

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

// Create multiple groups with increasing batch sizes
const results = await createGroupsWithIncrementalBatches(
  creator,
  allWorkers,
  startBatchSize,
  batchIncrement,
  maxParticipants,
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
