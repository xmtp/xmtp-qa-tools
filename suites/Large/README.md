# Large-Scale Performance Testing Suite

This test suite benchmarks XMTP protocol performance and scalability with large group conversations, providing comprehensive metrics for enterprise-scale deployments.

## What it does

- Measures group creation time and member addition performance at scale
- Benchmarks message delivery latency and reliability in large groups
- Tests group metadata update propagation and sync performance
- Evaluates cumulative sync performance as groups grow over time
- Validates member management operations in large group contexts
- Analyzes installation count impact on processing performance

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test against the corresponding network.

## How to run

### Run all large-scale tests

```bash
yarn test large
```

### Run specific test files

```bash
yarn test large/messages.test.ts      # Message delivery benchmarks
yarn test large/syncs.test.ts         # Sync performance testing
yarn test large/membership.test.ts    # Member management operations
yarn test large/conversations.test.ts # Conversation stream performance
yarn test large/metadata.test.ts      # Metadata update propagation
yarn test large/cumulative_syncs.test.ts # Cumulative sync analysis
```

## Test Components

### Core Test Files

- **[conversations.test.ts](./conversations.test.ts)** - Member addition performance and conversation stream verification
- **[messages.test.ts](./messages.test.ts)** - Message delivery latency and reliability benchmarks
- **[metadata.test.ts](./metadata.test.ts)** - Group metadata update propagation testing
- **[syncs.test.ts](./syncs.test.ts)** - Cold start sync times and group creation performance
- **[cumulative_syncs.test.ts](./cumulative_syncs.test.ts)** - Progressive sync performance analysis
- **[membership.test.ts](./membership.test.ts)** - Member addition/removal operation benchmarks
- **[helpers.ts](./helpers.ts)** - Shared utilities and test configuration

### Test Configuration

The suite uses configurable parameters in `helpers.ts`:

- `m_large_WORKER_COUNT` - Number of concurrent test workers
- `m_large_BATCH_SIZE` - Group size increment for testing
- `m_large_TOTAL` - Maximum group size to test
- `m_large_createGroup` - Standardized group creation utility

## Performance Results

Results and timing summaries are automatically saved to `logs/large.log` after each test run.

### Sender-Side Performance

| Size | Send Message | Update Name | Remove Members | Create Group | Performance   |
| ---- | ------------ | ----------- | -------------- | ------------ | ------------- |
| 50   | 86ms         | 135ms       | 139ms          | 1,329ms      | ✅ Excellent  |
| 100  | 88ms         | 145ms       | 157ms          | 1,522ms      | ✅ Excellent  |
| 150  | 95ms         | 203ms       | 190ms          | 2,306ms      | ✅ Good       |
| 200  | 93ms         | 193ms       | 205ms          | 3,344ms      | ⚠️ Acceptable |
| 300  | 97ms         | 244ms       | 247ms          | 5,463ms      | ⚠️ Concern    |
| 400  | 111ms        | 280ms       | 320ms          | 7,641ms      | ⚠️ Concern    |

### Receiver-Side Stream Performance

| Size | New Conversation | Metadata Update | Message Delivery | Add Members | Performance  |
| ---- | ---------------- | --------------- | ---------------- | ----------- | ------------ |
| 50   | 687ms            | 141ms           | 131ms            | 401ms       | ✅ Excellent |
| 100  | 746ms            | 155ms           | 117ms            | 420ms       | ✅ Excellent |
| 200  | 953ms            | 179ms           | 173ms            | 499ms       | ✅ Good      |
| 300  | 1,040ms          | 195ms           | 167ms            | 543ms       | ⚠️ Concern   |
| 400  | 1,192ms          | 214ms           | 173ms            | 609ms       | ⚠️ Concern   |

### Sync Performance Analysis

| Size | SyncAll (Cold Start) | Group Sync | Performance  |
| ---- | -------------------- | ---------- | ------------ |
| 50   | 366ms                | 291ms      | ✅ Excellent |
| 100  | 503ms                | 424ms      | ✅ Excellent |
| 200  | 854ms                | 653ms      | ✅ Good      |
| 300  | 1,225ms              | 861ms      | ⚠️ Concern   |
| 400  | 1,292ms              | 1,325ms    | ⚠️ Concern   |

## Installation Count Impact Analysis

### Processing Performance by Installation Count

| Installations/Member | Total Devices | Processing Time | New Member Time | Performance     |
| -------------------- | ------------- | --------------- | --------------- | --------------- |
| 2                    | 440           | 145ms           | 178ms           | ✅ Excellent    |
| 5                    | 1,100         | 267ms           | 312ms           | ✅ Good         |
| 10                   | 2,200         | 445ms           | 523ms           | ⚠️ Concern      |
| 15                   | 3,300         | 678ms           | 789ms           | ❌ Poor         |
| 20                   | 4,400         | 892ms           | 1,045ms         | ❌ Poor         |
| 25                   | 5,500         | 1,156ms         | 1,334ms         | ❌ Unacceptable |

_Base: 220 members, measuring time for existing member to process "new member added" commit_

## Performance Recommendations

### Optimal Configuration

- **Installation Limit**: Maximum 5 installations per member for optimal performance
- **Group Size**: Up to 200 members for excellent performance, 300+ requires consideration
- **Processing Threshold**: Keep member addition processing under 300ms

### Enterprise Scaling Guidelines

- **Small Groups** (≤50 members): No restrictions needed
- **Medium Groups** (51-200 members): Limit to 5 installations per member
- **Large Groups** (201-400 members): Strict 3-5 installation limit required
- **Enterprise Groups** (400+ members): Consider splitting into smaller groups

## Key Files

- **[conversations.test.ts](./conversations.test.ts)** - Conversation stream and member addition testing
- **[messages.test.ts](./messages.test.ts)** - Message delivery performance benchmarks
- **[syncs.test.ts](./syncs.test.ts)** - Synchronization performance analysis
- **[membership.test.ts](./membership.test.ts)** - Member management operation testing
- **[metadata.test.ts](./metadata.test.ts)** - Metadata update propagation testing
- **[cumulative_syncs.test.ts](./cumulative_syncs.test.ts)** - Progressive sync analysis
- **[helpers.ts](./helpers.ts)** - Shared utilities and configuration
- **[README.md](./README.md)** - This documentation
