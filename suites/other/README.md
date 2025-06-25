# 🔧 Other Test Suite

Specialized edge case testing and miscellaneous scenarios for validating XMTP protocol resilience, performance limits, and system behavior under unusual conditions.

## Quick Reference

| Test File                                            | Purpose                         | Key Features                                             | Execution                       |
| ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------- | ------------------------------- |
| **[chaos.test.ts](./chaos.test.ts)**                 | Multi-feature chaos testing     | Group stress, message verification, membership changes   | `yarn test other/chaos`         |
| **[nodetest.test.ts](./nodetest.test.ts)**           | Multi-installation sync testing | Installation chaos, sync validation, parallel operations | `yarn test other/nodetest`      |
| **[rate-limited.test.ts](./rate-limited.test.ts)**   | Rate limiting validation        | High-volume parallel messaging, worker thread testing    | `yarn test other/rate-limited`  |
| **[notifications.test.ts](./notifications.test.ts)** | Notification delivery testing   | DM and group notifications, manual user integration      | `yarn test other/notifications` |
| **[spam.test.ts](./spam.test.ts)**                   | Spam scenario testing           | Storage efficiency with spam inboxes, targeted testing   | `yarn test other/spam`          |
| **[storage.test.ts](./storage.test.ts)**             | Storage efficiency analysis     | Group size scaling, database optimization, cost analysis | `yarn test other/storage`       |

## 🌪️ Chaos & Stress Testing

### Multi-Feature Chaos Testing

Comprehensive stress testing that validates multiple protocol features simultaneously under chaotic conditions.

```bash
yarn test other/chaos
```

**Key Features:**

- **Message Stream Verification**: Validates message delivery across all groups
- **Membership Changes**: Tests dynamic member addition/removal
- **Metadata Updates**: Verifies group metadata synchronization
- **Epoch Changes**: Tests group state transitions
- **Random Installations**: Adds random installations during testing
- **Multi-Group Testing**: Creates and manages multiple groups simultaneously

**Test Configuration:**

- 40 worker names with fixed identities
- 60 random inbox IDs with random installations
- Manual user integration for production testing
- 3 epoch cycles with membership changes

### Multi-Installation Synchronization

Tests XMTP client synchronization across multiple installations of the same identity.

```bash
yarn test other/nodetest
```

**Chaos Parameters:**

- **Groups per Installation**: 20 groups
- **Messages per Group**: 20 messages
- **Members per Group**: 5 members
- **Total Installations**: 5 installations
- **Total Operations**: 2,500+ database operations

**Validation Points:**

- Cross-installation group synchronization
- Message consistency across installations
- Member state synchronization
- Database integrity verification
- API statistics tracking

## ⚡ Performance & Rate Limiting

### High-Volume Rate Limiting

Validates XMTP rate limiting mechanisms under extreme parallel load conditions.

```bash
yarn test other/rate-limited
```

**Load Configuration:**

- **Worker Threads**: 8 parallel workers
- **Messages per Worker**: 5,000 messages each
- **Total Messages**: 40,000 messages
- **Execution Mode**: True thread parallelism
- **Target Environment**: Production network

**Key Features:**

- Worker thread-based parallel execution
- Rate limiting boundary testing
- Production network validation
- Message burst testing

## 📱 Notification & Integration Testing

### Notification Delivery Validation

Tests push notification delivery across different conversation types.

```bash
yarn test other/notifications
```

**Test Scenarios:**

- **Group Notifications**: Multi-member group message notifications
- **DM Notifications**: Direct message notification delivery
- **Admin Operations**: Super admin permission notifications
- **Manual User Integration**: Real device notification testing

**Configuration:**

- Manual user: `fabri-convos-dev`
- 5 test workers sending notifications
- Both DM and group message scenarios
- Production/dev network support

## 🛡️ Security & Storage Testing

### Spam Scenario Testing

Validates system behavior when dealing with known spam inbox addresses.

```bash
yarn test other/spam
```

**Spam Testing:**

- **Target Spam Inbox**: `c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b`
- **Group Size**: 2-member groups with spam participant
- **Storage Target**: 10 MB database size
- **Validation**: Storage efficiency with spam content

### Storage Efficiency Analysis

Comprehensive storage cost analysis across different group sizes and usage patterns.

```bash
yarn test other/storage
```

**Analysis Parameters:**

- **Group Sizes**: 2, 10, 50, 100, 150, 200 members
- **Target Storage**: 5 MB per test scenario
- **Metrics Tracked**:
  - Storage per group
  - Cost per member
  - Receiver vs sender storage
  - Efficiency gains by group size

**Output Metrics:**

```
| Group Size | Groups | Sender Storage | Avg Group Size | Receiver Storage | Efficiency Gain |
|------------|--------|----------------|----------------|------------------|-----------------|
| 2 members  | 1,000  | 5.0 MB        | 0.005 MB       | 2.1 MB          | baseline        |
| 50 members | 200    | 5.0 MB        | 0.025 MB       | 2.1 MB          | 2.5× better     |
```

## 🚀 Running Specialized Tests

### Individual Test Execution

```bash
# Chaos testing - comprehensive multi-feature validation
yarn test suites/other/chaos.test.ts

# Multi-installation sync testing
yarn test suites/other/nodetest.test.ts

# Rate limiting validation
yarn test suites/other/rate-limited.test.ts

# Notification delivery testing
yarn test suites/other/notifications.test.ts

# Spam scenario testing
yarn test suites/other/spam.test.ts

# Storage efficiency analysis
yarn test suites/other/storage.test.ts
```

### Running All Other Tests

```bash
# Run entire other test suite
yarn test other

# Run with specific environment
XMTP_ENV=production yarn test other/rate-limited
XMTP_ENV=dev yarn test other/notifications
```

## 📊 Test Output & Analysis

### Chaos Testing Output

```
Group abc123 - Completed: verifyMessageStream
Group abc123 - Completed: verifyMembershipStream
Group abc123 - Completed: verifyMetadataStream
Group abc123 - Completed: verifyEpochChange
Worker Statistics: forks=0, errors=0, messages=500
```

### Storage Analysis Output

```
## Detailed Analysis
✅ 2-member groups: 1000 groups, 5.00 MB total
✅ 50-member groups: 200 groups, 5.00 MB total
✅ 200-member groups: 50 groups, 5.00 MB total

Efficiency Gain: 4× better storage efficiency with larger groups
```

### Rate Limiting Output

```
🚀 LAUNCHING 8 WORKER THREADS EACH SENDING 5000 MESSAGES!
🧵 Each worker runs in its own thread for TRUE parallelism
🔥 Worker thread henry starting burst...
Rate limiting engaged after 1,000 messages per thread
```

## 🔧 Configuration & Customization

### Environment Variables

```bash
# Network configuration
XMTP_ENV=dev|production|local

# Custom chaos parameters
CHAOS_GROUPS=20
CHAOS_MESSAGES=20
CHAOS_MEMBERS=5
CHAOS_INSTALLATIONS=5
```

### Test Customization

```typescript
// Modify chaos testing parameters
const testConfig = {
  epochs: 3, // Number of epoch cycles
  workerNames: 40, // Number of test workers
  randomInboxIds: 60, // Random participants
  groupName: "Custom Group", // Group naming
};

// Adjust storage testing targets
const memberCounts = [2, 10, 50, 100, 150, 200];
const targetSizeMB = 5;

// Configure rate limiting parameters
const messagesPerWorker = 5000;
const workerCount = 8;
```

## 🎯 Use Cases

### Development & Testing

- **Edge Case Validation**: Test unusual scenarios and boundary conditions
- **Performance Benchmarking**: Measure system limits under stress
- **Regression Prevention**: Validate fixes for historical issues
- **Integration Testing**: Test real-world notification delivery

### Production Monitoring

- **Rate Limit Validation**: Ensure rate limiting works correctly
- **Storage Optimization**: Analyze storage costs for different usage patterns
- **Spam Detection**: Validate behavior with known spam addresses
- **Multi-Device Sync**: Test synchronization across installations

### Security & Compliance

- **Spam Resistance**: Validate system behavior with malicious actors
- **Storage Efficiency**: Optimize database usage for cost control
- **Notification Delivery**: Ensure critical messages reach users
- **System Resilience**: Test recovery from chaotic conditions

This test suite provides comprehensive validation of XMTP protocol behavior under specialized conditions, ensuring robust performance across edge cases and unusual scenarios.
