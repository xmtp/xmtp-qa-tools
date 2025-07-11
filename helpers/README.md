# Testing Helpers

Utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test workers, collecting metrics, and validating test results.

## Quick Reference

| Module            | Purpose                          | Key Features                                         |
| ----------------- | -------------------------------- | ---------------------------------------------------- |
| **client.ts**     | XMTP client creation             | Signers, encryption keys, SDK versioning, DB paths   |
| **analyzer.ts**   | Log analysis and error detection | Error pattern matching, log filtering, deduplication |
| **logger.ts**     | Logging utilities                | File logging, ANSI stripping, pretty console output  |
| **vitest.ts**     | Test lifecycle management        | Test setup, performance metrics, cleanup             |
| **playwright.ts** | Browser automation               | UI testing, group creation, message verification     |
| **datadog.ts**    | Metrics and monitoring           | Performance tracking, network stats, reporting       |
| **streams.ts**    | Message streaming utilities      | Stream verification, message delivery testing        |

## Usage

```typescript
import {
  extractErrorLogs,
  shouldFilterOutTest,
  workflowFailed,
} from "@helpers/analyzer";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { initDataDog, sendPerformanceMetric } from "@helpers/datadog";
import { setupPrettyLogs } from "@helpers/logger";
import {
  verifyConversationStream,
  verifyMessageStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
```

## Client Module

Create and manage XMTP clients across different SDK versions.

```typescript
// Create a signer for an XMTP client
const signer = createSigner(WALLET_KEY);

// Generate an encryption key
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Create an XMTP client with specific version
const clientData = await createClient(
  walletKey,
  encryptionKeyHex,
  { sdkVersion: "220", name: "alice", testName, folder: "test-run" },
  "dev",
);

// Log agent details with connection info
await logAgentDetails(client);
```

Functions: Multi-version SDK support, signer creation, database management, environment configuration, key generation.

## Analyzer Module

Log analysis and error detection capabilities for identifying test failures and patterns.

```typescript
// Extract error logs from test output
const errorLogs = extractErrorLogs(testName, 50);

// Check if test failures match known issues
const shouldFilter = shouldFilterOutTest(errorLogs);

// Extract test failure lines specifically
const fail_lines = extractfail_lines(errorLogs);

// Process and clean error lines
const { cleanLine, shouldSkip } = processErrorLine(rawLogLine);
```

Known issue patterns:

```typescript
export const PATTERNS = {
  KNOWN_ISSUES: [
    {
      testName: "Browser",
      uniqueErrorLines: ["FAIL suites/browser/browser.test.ts"],
    },
    {
      testName: "Dms",
      uniqueErrorLines: ["FAIL suites/functional/dms.test.ts"],
    },
  ],
  DEDUPE: ["sync worker error", "sqlcipher_mlock", "Collector timed out"],
  MATCH: [/ERROR/, /forked/, /FAIL/, /QA_ERROR/],
};
```

Functions: Error pattern matching, log deduplication, ANSI code handling, test filtering.

## Logger Module

Logging utilities with file output and formatting.

```typescript
// Set up pretty console logging
setupPrettyLogs(testName);

// Add file logging capability
addFileLogging(testName);

// Create a test logger with options
const logger = createTestLogger({
  enableLogging: true,
  testName: "my-test",
  verboseLogging: true,
});

// Clean log files by removing ANSI codes
await cleanAllRawLogs();
```

Functions: File logging, ANSI code stripping, pretty formatting, log processing, Winston integration.

## Vitest Module

Test lifecycle management and performance tracking integration.

```typescript
// Set up test lifecycle with automatic metrics
setupTestLifecycle({
  testName: "my-test-suite",
  expect,
  getCustomDuration: () => customDuration,
  setCustomDuration: (v) => {
    customDuration = v;
  },
});
```

Lifecycle hooks:

- `beforeAll`: Loads environment configuration
- `beforeEach`: Starts performance timing
- `afterEach`: Sends performance metrics
- `afterAll`: Flushes metrics and cleanup

Functions: Automatic setup, performance tracking, custom duration support, cleanup management.

## Playwright Module

Browser automation for testing XMTP web applications.

```typescript
// Create a Playwright instance
const browser = new playwright({
  headless: true,
  env: "dev",
  defaultUser: {
    walletKey: "0x...",
    accountAddress: "0x...",
    dbEncryptionKey: "...",
    inboxId: "...",
  },
});

// Start browser session
const { page } = await browser.startPage();

// Create a new group through UI
const groupId = await browser.newGroupFromUI([address1, address2]);

// Send a message
await browser.sendMessage("Hello world!");

// Wait for response
const received = await browser.waitForResponse(["Hello", "response"]);

// Take a screenshot
await browser.takeSnapshot("test-completed");
```

Functions: Headless browser automation, XMTP web app integration, group management, message testing, screenshot capture.

## Datadog Module

Metrics collection and performance tracking integration.

```typescript
// Initialize Datadog metrics
initDataDog();

// Send custom metrics
sendMetric("test.duration", 1234, {
  operation: "createGroup",
  test: "functional",
  members: "10",
  installations: "10",
});

// Send performance metrics with network stats
await sendPerformanceMetric(duration, testName, false);

// Get network performance statistics
const networkStats = await getNetworkStats("https://grpc.dev.xmtp.network:443");

// Flush all metrics
await flushMetrics();

// Send logs to Datadog
sendDatadogLog(["Error line 1", "Error line 2"], {
  test: testName,
  env: "dev",
});
```

Functions: Performance monitoring, network statistics, metric aggregation, geographic tracking.

## Streams Module

Message streaming utilities for verifying stream functionality and message delivery.

```typescript
// Verify conversation stream
await verifyConversationStream(worker, expectedCount);

// Verify message stream
await verifyMessageStream(worker, expectedMessages);

// Stream message verification with timeout
const messages = await streamMessages(worker, timeout);

// Check stream health
const isHealthy = await checkStreamHealth(stream);
```

Functions: Stream verification, message delivery testing, timeout handling, stream health monitoring.
