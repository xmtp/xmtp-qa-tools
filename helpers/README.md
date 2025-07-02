# 🧰 XMTP Testing Helpers

This directory contains utility modules that power the XMTP testing framework. These helpers provide the foundation for creating test scenarios, managing test workers, collecting metrics, and validating test results.

## Quick reference

| Module               | Purpose                          | Key Features                                         |
| -------------------- | -------------------------------- | ---------------------------------------------------- |
| **client.ts**        | XMTP client creation             | Signers, encryption keys, SDK versioning, DB paths   |
| **analyzer.ts**      | Log analysis and error detection | Error pattern matching, log filtering, deduplication |
| **notifications.ts** | Test failure notifications       | Slack alerts, error reporting, filtering             |
| **logger.ts**        | Logging utilities                | File logging, ANSI stripping, pretty console output  |
| **vitest.ts**        | Test lifecycle management        | Test setup, performance metrics, cleanup             |
| **playwright.ts**    | Browser automation               | UI testing, group creation, message verification     |
| **datadog.ts**       | Metrics and monitoring           | Performance tracking, network stats, reporting       |
| **streams.ts**       | Message streaming utilities      | Stream verification, message delivery testing        |

## Usage

The helper modules are designed to be imported and used in test suites:

```typescript
import { extractErrorLogs, shouldFilterOutTest } from "@helpers/analyzer";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { initDataDog, sendPerformanceMetric } from "@helpers/datadog";
import { logError, setupPrettyLogs } from "@helpers/logger";
import { sendSlackNotification } from "@helpers/notifications";
import {
  verifyConversationStream,
  verifyMessageStream,
} from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
```

## 🔑 Client Module (`client.ts`)

The `client.ts` module provides utilities for creating and managing XMTP clients across different SDK versions.

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

**Key features:**

- **Multi-version SDK support**: Works with SDK versions 47, 100, 105, 209, 210, 220, and MLS
- **Signer creation**: Compatible signers for different SDK versions
- **Database management**: Automatic database path creation and management
- **Environment configuration**: Loading and validating environment variables
- **Key generation**: Private key and encryption key utilities

**SDK Version Mappings:**

```typescript
export const VersionList = {
  47: { Client: Client47, sdkVersion: "0.0.47", libXmtpVersion: "6bd613d" },
  100: { Client: Client100, sdkVersion: "1.0.0", libXmtpVersion: "c205eec" },
  105: { Client: Client105, sdkVersion: "1.0.5", libXmtpVersion: "6eb1ce4" },
  209: { Client: Client209, sdkVersion: "2.0.9", libXmtpVersion: "bfadb76" },
  210: { Client: Client210, sdkVersion: "2.1.0", libXmtpVersion: "7b9b4d0" },
  220: { Client: Client220, sdkVersion: "2.2.0", libXmtpVersion: "d0f0b67" },
  // ... and more
};
```

## 🔍 Analyzer Module (`analyzer.ts`)

The `analyzer.ts` module provides log analysis and error detection capabilities for identifying test failures and patterns.

```typescript
// Extract error logs from test output
const errorLogs = extractErrorLogs(testName, 50);

// Check if test failures match known issues
const shouldFilter = shouldFilterOutTest(errorLogs);

// Extract test failure lines specifically
const failLines = extractFailLines(errorLogs);

// Process and clean error lines
const { cleanLine, shouldSkip } = processErrorLine(rawLogLine);
```

**Key features:**

- **Error pattern matching**: Identifies known test issues and failure patterns
- **Log deduplication**: Removes duplicate error messages to reduce noise
- **ANSI code handling**: Cleans logs from terminal formatting codes
- **Test filtering**: Determines if test failures are known issues to avoid false alerts

**Known Issue Patterns:**

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

## 📢 Notifications Module (`notifications.ts`)

The `notifications.ts` module handles test failure notifications through Slack integration.

```typescript
// Send a Slack notification for test failures
await sendSlackNotification({
  testName: "functional-tests",
  label: "error",
  errorLogs: extractedLogs,
  jobStatus: "failed",
  env: "dev",
  failedTestsCount: 3,
  totalTestsCount: 10,
});
```

**Key features:**

- **Slack integration**: Sends formatted notifications to Slack channels
- **Smart filtering**: Avoids spam by filtering known issues and branch restrictions
- **Rich formatting**: Includes links to dashboards, logs, and test runs
- **Error context**: Provides relevant error logs and failure details

**Configuration:**

```typescript
const URLS = {
  DATADOG_DASHBOARD: "https://app.datadoghq.com/dashboard/...",
  DATADOG_LOGS: "https://app.datadoghq.com/logs?saved-view-id=...",
  SLACK_API: "https://slack.com/api/chat.postMessage",
  GITHUB_ACTIONS: "https://github.com",
};
```

## 📝 Logger Module (`logger.ts`)

The `logger.ts` module provides comprehensive logging utilities with file output and formatting.

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

// Log errors with consistent formatting
logError(error);

// Clean log files by removing ANSI codes
await cleanAllRawLogs();
```

**Key features:**

- **File logging**: Automatic log file creation with timestamps
- **ANSI code stripping**: Removes terminal formatting for clean log files
- **Pretty formatting**: Colorized console output with timestamps
- **Log processing**: Utilities for cleaning and processing large log files
- **Winston integration**: Professional logging with multiple transports

## 🧪 Vitest Module (`vitest.ts`)

The `vitest.ts` module provides test lifecycle management and performance tracking integration.

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

**Key features:**

- **Automatic setup**: Handles environment loading and metric initialization
- **Performance tracking**: Measures test duration and sends metrics to Datadog
- **Custom duration support**: Allows tests to override automatic timing
- **Cleanup management**: Ensures proper cleanup after test completion

**Lifecycle hooks:**

- `beforeAll`: Loads environment configuration
- `beforeEach`: Starts performance timing
- `afterEach`: Sends performance metrics
- `afterAll`: Flushes metrics and cleanup

## 🌐 Playwright Module (`playwright.ts`)

The `playwright.ts` module provides browser automation for testing XMTP web applications.

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

**Key features:**

- **Headless browser automation**: Runs tests in Chrome/Chromium
- **XMTP web app integration**: Pre-configured for XMTP chat interfaces
- **Group management**: Create groups and manage members through UI
- **Message testing**: Send messages and verify delivery
- **Screenshot capture**: Visual debugging and test verification

## 📊 Datadog Module (`datadog.ts`)

The `datadog.ts` module provides metrics collection and performance tracking integration.

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
await sendDatadogLog(["Error line 1", "Error line 2"], {
  test: testName,
  env: "dev",
});
```

**Key features:**

- **Performance monitoring**: Tracks test execution times and operation durations
- **Network statistics**: Measures DNS, TCP, TLS, and processing times
- **Metric aggregation**: Collects and groups metrics by operation and member count
- **Geographic tracking**: Includes region and country information
- **Log integration**: Sends structured logs to Datadog Logs

**Network Statistics:**

```typescript
interface NetworkStats {
  "DNS Lookup": number;
  "TCP Connection": number;
  "TLS Handshake": number;
  Processing: number;
  "Server Call": number;
}
```

## 🔄 Streams Module (`streams.ts`)

The `streams.ts` module provides utilities for testing message delivery and conversation streams.

```typescript
// Verify message delivery to all participants
const result = await verifyMessageStream(
  conversation,
  participants,
  "text",
  messageCount,
  messageGenerator,
  messageSender,
);

// Verify metadata updates are received
const metadataResult = await verifyMetadataStream(
  group,
  participants,
  metadataUpdates,
);

// Verify membership changes
const membershipResult = await verifyMembershipStream(
  group,
  participants,
  membershipChanges,
);

// Verify conversation creation events
const conversationResult = await verifyConversationStream(
  initiator,
  participants,
);

// Calculate message delivery statistics
const stats = calculateMessageStats(
  messagesByWorker,
  messagePrefix,
  messageCount,
  suffix,
);
```

**Key features:**

- **Message verification**: Ensures all participants receive expected messages
- **Stream testing**: Tests real-time message, conversation, and metadata streams
- **Delivery statistics**: Calculates success rates and timing metrics
- **Content type support**: Works with text, reactions, replies, and other content types
- **Group operations**: Verifies group updates, member additions, and metadata changes

**Stream Types Supported:**

- Message streams (text, reactions, replies)
- Conversation streams (new conversations)
- Metadata streams (group name, description changes)
- Membership streams (member additions/removals)
- Consent streams (contact approvals)

## 🔧 Environment Configuration

All helper modules work together through environment configuration:

```bash
# Required environment variables
XMTP_ENV=dev                    # XMTP environment (dev, production)
LOGGING_LEVEL=info              # Log level (debug, info, warn, error)
DATADOG_API_KEY=...             # For metrics reporting
SLACK_BOT_TOKEN=...             # For failure notifications
SLACK_CHANNEL=general           # Slack channel for notifications
GEOLOCATION=us-east             # Geographic region for testing
```

## 📁 Data Files

### External Dependencies

The helpers reference data files in other directories:

- **`@inboxes/manualusers.json`**: Pre-configured test user accounts
- **`@inboxes/*.json`**: Generated test identities and wallet data
- **Environment variables**: Loaded from `.env` files

## 🚀 Getting Started

To use the helpers in your tests:

1. **Import the required helpers**:

```typescript
import { createSigner } from "@helpers/client";
import { verifyMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
```

2. **Set up test lifecycle**:

```typescript
describe("My Test Suite", () => {
  setupTestLifecycle({
    testName: "my-test-suite",
    expect,
  });

  // Your tests here
});
```

3. **Create XMTP clients**:

```typescript
const signer = createSigner(walletKey);
const client = await createClient(walletKey, encryptionKey, config, env);
```

4. **Verify message delivery**:

```typescript
const result = await verifyMessageStream(
  conversation,
  participants,
  messageCount,
);
expect(result.allReceived).toBe(true);
```

The helpers are designed to work together seamlessly, providing a comprehensive testing framework for XMTP applications.

# Helper Functions Documentation

This directory contains utility functions to assist with testing XMTP features.

## Available Functions

### `streams.ts` - Stream Verification Functions

```typescript
import { verifyMessageStream } from "@helpers/streams";

// Message delivery verification
const result = await verifyMessageStream(
  conversation,
  [receiverWorker],
  messageCount,
  messageTemplate,
);
```

### `logger.ts` - Logging Utilities

```typescript
import { getTime, setupPrettyLogs } from "@helpers/logger";

// Get formatted timestamp
const timestamp = getTime();

// Set up pretty console logging
const restore = setupPrettyLogs(testName);
```

### `client.ts` - Client Management

```typescript
import { loadEnv } from "@helpers/client";

// Load environment configuration
loadEnv(testName);
```

### `vitest.ts` - Test Lifecycle

```typescript
import { setupTestLifecycle } from "@helpers/vitest";

// Set up proper test cleanup and lifecycle management
setupTestLifecycle({});
```

### `datadog.ts` - Metrics and Analytics

```typescript
import { flushMetrics, sendMetric } from "@helpers/datadog";

// Send performance metrics
sendMetric("duration", timing, metadata);

// Flush all pending metrics
await flushMetrics();
```

### `notifications.ts` - Slack Integration

```typescript
import { sendSlackMessage } from "@helpers/notifications";

// Send notifications to Slack
await sendSlackMessage(channel, message);
```

### `playwright.ts` - Browser Testing

```typescript
import { setupPlaywright } from "@helpers/playwright";

// Set up browser testing environment
const { page, browser } = await setupPlaywright();
```

The helpers are designed to work together seamlessly, providing a comprehensive testing framework for XMTP applications.
