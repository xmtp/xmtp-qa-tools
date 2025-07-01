# 🧪 Test Suites

Comprehensive end-to-end test suites for validating XMTP protocol functionality, performance, and reliability across different scenarios and environments.

## Quick Reference

| Test Suite                      | Purpose                            | Key Features                                 | Documentation                       |
| ------------------------------- | ---------------------------------- | -------------------------------------------- | ----------------------------------- |
| **[agents](./agents/)**         | Production agent health monitoring | Live agent testing, response validation      | [📖 README](./agents/README.md)     |
| **[bench](./bench/)**           | Performance benchmarking           | Throughput measurement, latency analysis     | [📖 README](./bench/README.md)      |
| **[browser](./browser/)**       | Browser integration validation     | Playwright automation, cross-browser testing | [📖 README](./browser/README.md)    |
| **[bugs](./bugs/)**             | Bug reproduction and tracking      | Historical issues, regression prevention     | [📖 README](./bugs/README.md)       |
| **[functional](./functional/)** | Core protocol functionality        | Complete feature coverage, integration tests | [📖 README](./functional/README.md) |
| **[group](./group/)**           | Group conversation testing         | Stress testing, multi-version compatibility  | [📖 README](./group/README.md)      |
| **[large](./large/)**           | Large-scale performance testing    | Scalability validation, resource monitoring  | [📖 README](./large/README.md)      |
| **[metrics](./metrics/)**       | Performance metrics collection     | Delivery reliability, operational metrics    | [📖 README](./metrics/README.md)    |
| **[mobile](./mobile/)**         | Mobile performance testing         | Load testing, responsiveness validation      | [📖 README](./mobile/README.md)     |
| **[other](./other/)**           | Specialized edge case testing      | Rate limiting, storage, notifications, etc   | [View tests →](./other/)            |

## 🤖 Production & Monitoring

### Agent Health Testing

Validates production XMTP agents for responsiveness and functionality.

```bash
yarn test agents
```

**Key Features:**

- Live agent health checks
- Response time validation
- Message delivery verification
- Multi-network support (dev/production)

### Performance Benchmarking

Comprehensive performance measurement and analysis toolkit.

```bash
yarn test bench
```

**Key Features:**

- Message throughput benchmarking
- Latency measurement across operations
- Performance regression detection
- CSV data export for analysis

## ⚙️ Core Functionality Testing

### Functional Test Suite

Complete validation of XMTP protocol features and capabilities.

```bash
yarn test functional
```

**Test Coverage:**

- **Client Management**: Connection, authentication, lifecycle
- **Conversations**: DMs, groups, metadata management
- **Messaging**: Content types, delivery, ordering
- **Streams**: Real-time message streaming, callbacks
- **Consent**: Permission management, blocking/allowing
- **Installations**: Multi-device support, synchronization
- **Codec**: Content encoding/decoding, error handling
- **Offline**: Disconnection handling, message queuing
- **Sync**: Data synchronization, consistency
- **Regression**: Historical bug prevention

**Individual Test Files:**

```bash
yarn test suites/functional/streams.test.ts     # Message streaming
yarn test suites/functional/groups.test.ts      # Group functionality
yarn test suites/functional/dms.test.ts         # Direct messaging
yarn test suites/functional/sync.test.ts        # Synchronization
yarn test suites/functional/consent.test.ts     # Consent management
```

### Browser Integration Testing

Cross-browser compatibility and web integration validation.

```bash
yarn test browser
```

**Key Features:**

- Playwright-based automation
- Cross-browser compatibility testing
- Web integration scenarios
- UI/UX validation

## 🔄 Group & Conversation Testing

### Group Stress Testing

Specialized testing for group conversations under various stress conditions.

```bash
yarn test group
```

**Key Features:**

- Multi-version compatibility testing
- Membership change stress testing
- Group metadata operations
- Admin permission validation
- Message stream performance
- Concurrent worker scenarios

## 🚀 Performance & Scale Testing

### Large-Scale Testing

Comprehensive scalability and performance validation under high load.

```bash
yarn test large
```

**Test Categories:**

- **Conversations**: Large conversation set management
- **Cumulative Syncs**: Progressive synchronization testing
- **Membership**: Large group member management
- **Messages**: High-volume message handling
- **Metadata**: Bulk metadata operations
- **Syncs**: Large-scale synchronization performance

**Individual Test Files:**

```bash
yarn test suites/large/conversations.test.ts    # Conversation scaling
yarn test suites/large/membership.test.ts       # Member management
yarn test suites/large/messages.test.ts         # Message volume
yarn test suites/large/syncs.test.ts           # Sync performance
```

### Performance Metrics

Detailed performance measurement and reliability validation.

```bash
yarn test metrics
```

**Key Metrics:**

- **Delivery Testing**: End-to-end message delivery reliability
- **Performance Analysis**: Operational performance measurement
- **Latency Tracking**: Response time analysis
- **Throughput Measurement**: Message processing capacity

**Individual Test Files:**

```bash
yarn test suites/metrics/delivery.test.ts       # Delivery reliability
yarn test suites/metrics/performance.test.ts    # Performance metrics
```

### Mobile Performance Testing

Mobile application performance validation under various load conditions.

```bash
yarn test mobile
```

**Load Configurations:**

- **Small**: Basic mobile performance
- **Medium**: Moderate load scenarios
- **Large**: High load testing
- **XL**: Maximum capacity testing

### Storage Efficiency Testing

Database optimization and storage utilization analysis.

```bash
yarn test storage
```

**Key Features:**

- Storage cost analysis across group sizes
- Database efficiency measurement
- Space utilization optimization
- Performance vs. storage trade-offs

## 🔒 Security & Quality Assurance

### Spam & Security Testing

Comprehensive security validation and threat prevention testing.

```bash
yarn test spam
```

**Key Features:**

- Spam detection validation
- Security threat simulation
- Content filtering testing
- Protection mechanism verification

### Notification Testing

Push notification delivery and integration validation.

```bash
yarn test notifications
```

**Key Features:**

- Notification delivery testing
- Integration with notification services
- Delivery reliability validation
- Multi-platform support

## 🐛 Bug Documentation & Regression

### Bug Reproduction Testing

Historical bug tracking and regression prevention.

```bash
yarn test bugs
```

**Bug Categories:**

- **Member Addition Issues**: Group membership problems
- **KPKE Errors**: Key package encryption issues
- **Panic Scenarios**: System crash conditions
- **Welcome Message Problems**: Onboarding issues
- **Stitching Bugs**: Message continuity problems
- **Other Issues**: Miscellaneous edge cases

**Bug Documentation Structure:**

- Individual directories for each bug category
- Reproduction test cases
- Log files and error traces
- Resolution documentation

## 🔧 Specialized Testing

### Rate Limiting & Edge Cases

Testing for specialized scenarios and edge cases.

```bash
yarn test other/rate-limited.test.ts
```

**Coverage:**

- Rate limiting validation
- Edge case scenario testing
- Boundary condition validation
- Error handling verification

## 🏃‍♂️ Running Tests

### Basic Test Execution

```bash
# Run specific test suites
yarn test agents              # Production agent health
yarn test functional          # Core functionality
yarn test groups             # Group stress testing
yarn test mobile             # Mobile performance
yarn test storage            # Storage efficiency
yarn test metrics/delivery   # Delivery reliability
yarn test metrics/performance # Performance metrics
yarn test browser            # Browser integration
yarn test notifications      # Push notifications
yarn test spam               # Security testing
yarn test bench              # Performance benchmarking

# Run individual test files
yarn test suites/functional/streams.test.ts
yarn test suites/large/membership.test.ts
yarn test suites/mobile/mobile.test.ts
yarn test suites/bugs/bug_addmember/test.test.ts
```

### Advanced Test Configuration

#### Multi-Version Testing

Test compatibility across different SDK versions:

```bash
# Test with random mix of versions 2.0.9 and 2.1.0
yarn cli test functional --versions 3
```

#### Environment Configuration

Configure test environment and network:

```bash
# Set environment for testing
export XMTP_ENV=dev          # Development network
export XMTP_ENV=production   # Production network
export XMTP_ENV=local        # Local testing
```

#### Custom Test Configuration

Configure specific test parameters:

```bash
# Run with custom worker count
yarn test large --workers 10

# Run with specific timeout
yarn test functional --timeout 30000

# Run with verbose output
yarn test --verbose
```

## 📊 Test Coverage & Validation

### Comprehensive Protocol Coverage

Our test suites provide complete coverage across all XMTP protocol features:

**Core Protocol Features:**

- ✅ Direct Messages (DMs)
- ✅ Group Conversations
- ✅ Installation Management
- ✅ Metadata Operations
- ✅ Message Streaming
- ✅ Synchronization
- ✅ Content Types & Codecs
- ✅ Consent Management

**Performance & Scalability:**

- ✅ Message Delivery Reliability
- ✅ Storage Efficiency Analysis
- ✅ Mobile Responsiveness
- ✅ Large-Scale Operations
- ✅ Concurrent User Scenarios
- ✅ Network Performance

**Security & Quality:**

- ✅ Spam Prevention
- ✅ Permission Controls
- ✅ Threat Detection
- ✅ Content Filtering
- ✅ Error Handling
- ✅ Edge Case Validation

**Integration & Compatibility:**

- ✅ Multi-Version Support
- ✅ Cross-Browser Testing
- ✅ Mobile Platforms
- ✅ Notification Services
- ✅ Development Environments

### Test Implementation Patterns

#### Using Worker Framework for Testing

All tests use the standardized worker framework for consistent test environments:

```typescript
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";

const testName = "my-test";

describe(testName, async () => {
  const workers = await getWorkers(["alice", "bob"]);

  setupTestLifecycle({
    expect,
    workers,
    testName,
  });

  it("should test functionality", async () => {
    const alice = workers.get("alice");
    const bob = workers.get("bob");

    // Test implementation
  });
});
```

#### Performance Measurement

Utilize built-in performance measurement tools:

```typescript
import { verifyMessageStream } from "@helpers/streams";

// Verify message delivery performance
const verifyResult = await verifyMessageStream(
  conversation,
  [workers.get("bob")!],
  messageCount,
);
expect(verifyResult.allReceived).toBe(true);
```

## 🔧 Available SDK Versions

The testing framework supports the following XMTP SDK versions for compatibility testing:

- `0.0.47` (legacy)
- `1.0.0`
- `1.0.5`
- `2.0.9`
- `2.1.0`
- `2.1.1` (latest)

  When `--versions` is specified, workers will be randomly assigned versions from the provided list. When not specified, the latest version is used by default.

## 📈 Continuous Integration

All test suites are integrated with GitHub Actions for continuous monitoring:

- **Automated Execution**: Tests run on code changes and scheduled intervals
- **Performance Monitoring**: Continuous performance regression detection
- **Multi-Environment Testing**: Validation across dev/production environments
- **Failure Alerting**: Immediate notification of test failures
- **Historical Tracking**: Long-term trend analysis and reporting

View the automated test execution in the [GitHub Actions Workflows](https://github.com/xmtp/xmtp-qa-tools/actions).
