# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test personas, collecting metrics, and validating test results.

## 📋 Core Modules

| Module                   | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| [client.ts](#clientts)   | Creates signers and manages keys for test personas      |
| [datadog.ts](#datadogts) | Sends performance metrics to Datadog                    |
| [factory.ts](#factoryts) | Creates and manages test personas with workers          |
| [group.ts](#groupts)     | Creates test groups with specified participants         |
| [logger.ts](#loggerts)   | Logging utilities for test output                       |
| [main.ts](#maints)       | Worker client implementation for multi-threaded testing |
| [reflect.ts](#reflectts) | Integration with Reflect testing platform               |
| [thread.ts](#threadts)   | Worker thread implementation for background processing  |
| [types.ts](#typests)     | Type definitions used throughout the testing framework  |
| [verify.ts](#verifyts)   | Validation utilities for testing message delivery       |

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

### factory.ts

Creates and manages test personas:

```typescript
// Get a collection of test personas
const personas = await getWorkers(["alice", "bob", "randomguy"], testName);

// Create persona objects with appropriate keys and clients
const personaFactory = new PersonaFactory(testName, typeofStream);
const personas = await personaFactory.createPersonas(descriptors);

const bob = personas.get("bob");
// Clear worker cache when tests are complete
await clearWorkerCache();
```

To see more about the factory, check the [workers section](../WORKERS.md) file

### group.ts

Utilities for creating and managing test groups:

```typescript
// Create a group with a specific number of participants
const result = await createGroupWithBatch(
  creator,
  allPersonas,
  batchSize,
  installationsPerUser,
);

// Create multiple groups with increasing batch sizes
const results = await createGroupsWithIncrementalBatches(
  creator,
  allPersonas,
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

### main.ts

Worker client implementation for multi-threaded testing:

```typescript
// Create a worker client for a persona
const worker = new WorkerClient(persona, typeofStream);

// Initialize the worker with an XMTP client
const { client, dbPath, version } = await worker.initialize();

// Collect messages from a conversation
const messages = await worker.collectMessages(groupId, contentType, count);

// Collect conversation events
const conversations = await worker.collectConversations(peerAddress, count);

// Clean up when done
await worker.terminate();
```

### reflect.ts

Integration with the Reflect testing platform:

```typescript
// Create a Reflect test suite
const reflectTestSuite = new ReflectTestSuite();

// Run GM sending test
const result = await reflectTestSuite.runSendingGmTest();

// Monitor test execution status
await reflectTestSuite.pollExecutionStatus(reflectTestSuite, executionId);
```

### thread.ts

Worker thread implementation for background processing:

```typescript
// Listen for messages from parent thread
parentPort.on("message", (message) => {
  // Handle initialization and other commands
});

// Error handling for worker threads
process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});
```

### types.ts

Type definitions used throughout the testing framework:

```typescript
// Core types for personas and clients
interface Persona {
  name: string;
  installationId: string;
  version: string;
  dbPath: string;
  worker: WorkerClient | null;
  client: Client | null;
}

// Message and conversation stream types
type WorkerStreamMessage = {
  type: "stream_message";
  message: DecodedMessage;
};

// Verification result types
type VerifyStreamResult = {
  allReceived: boolean;
  messages: string[][];
};
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
  messagesByPersona,
  messagePrefix,
  messageCount,
  suffix,
);
```

## 📊 Helper Data Files

The `generated-inboxes.json` file contains pre-generated wallet addresses and inbox IDs for testing. This is used to quickly set up test scenarios without having to create new wallets each time.

## 🧩 How Components Work Together

1. **Test Setup**:

   - `factory.ts` creates test personas with appropriate keys
   - `client.ts` handles signer creation and database paths
   - `logger.ts` provides logging capabilities

2. **Test Execution**:

   - `main.ts` and `thread.ts` handle multi-threaded message processing
   - `group.ts` creates test groups with specific participants
   - `verify.ts` validates message delivery

3. **Metrics Collection**:
   - `datadog.ts` sends performance and reliability metrics to Datadog
   - Performance metrics include operation duration and network stats
   - Delivery metrics track message reception rates

## 📈 Performance Testing

The helpers provide tools for performance testing:

1. Use `createGroupsWithIncrementalBatches` to test group creation with increasing sizes
2. Use `sendPerformanceMetric` to track operation duration
3. Use `getNetworkStats` to measure network performance
4. Analyze results in Datadog dashboards

## 🔄 Message Delivery Testing

For testing message delivery reliability:

1. Use `verifyStream` or `verifyStreamAll` to send test messages
2. Use `calculateMessageStats` to analyze message reception rates
3. Track delivery metrics with `sendDeliveryMetric`

These helpers form the foundation of XMTP's continuous testing infrastructure, ensuring reliable performance and message delivery across different environments.
