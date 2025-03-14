# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test personas, collecting metrics, and validating test results.

## 📋 Core Modules

| Module                   | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| [client.ts](#clientts)   | Creates signers and manages keys for test personas |
| [datadog.ts](#datadogts) | Sends performance metrics to Datadog               |
| [group.ts](#groupts)     | Creates test groups with specified participants    |
| [logger.ts](#loggerts)   | Logging utilities for test output                  |
| [test.ts](#testts)       | Test utilities for creating and managing tests     |
| [verify.ts](#verifyts)   | Validation utilities for testing message delivery  |
| [railway.ts](#railwayts) | Railway utilities for testing message delivery     |

## 🔍 Module Details

### client.ts

Handles XMTP client creation and key management:

```typescript
// Create a signer for a private key
const signer = createSigner(privateKey);

// Generate a path for the client database
const dbPath = getDbPath(personaName, accountAddress, testName);

// Generate random encryption keys
const encryptionKey = generateEncryptionKeyHex();
```

### datadog.ts

Sends performance metrics to Datadog for monitoring:

```typescript
// Initialize Datadog metrics
initDataDog(testName, envValue, geolocation, apiKey);

// Send delivery rate metrics
sendDeliveryMetric(deliveryRate, testName, libxmtpVersion);

// Send performance metrics
sendPerformanceMetric(durationMs, testName, libxmtpVersion);

// Measure network performance
const networkStats = await getNetworkStats();
```

### group.ts

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

### verify.ts

Validation utilities for testing message delivery:

```typescript
// Verify that all participants in a group receive messages
const result = await verifyStreamAll(group, personas, messageCount);

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
