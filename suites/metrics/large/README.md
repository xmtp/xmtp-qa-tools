# Large-Scale Performance Testing Suite

This test suite benchmarks XMTP protocol performance and scalability with large group conversations, providing comprehensive metrics for enterprise-scale deployments.

## What it does

- **Message Delivery Performance**: Tests message stream delivery times with groups ranging from 5-10 members
- **Sync Performance Analysis**: Measures cold start sync times for group creation, syncAll, and individual sync operations
- **Conversation Stream Testing**: Evaluates new conversation notification delivery times across multiple group sizes
- **Cumulative Sync Impact**: Tests progressive sync performance degradation as group database grows
- **Membership Management**: Benchmarks group member addition notification delivery times across varying group sizes
- **Metadata Updates**: Analyzes group metadata update notification delivery times across different group sizes

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test against the corresponding network.

## How to run

### Run all large-scale tests

```bash
yarn test large
```

### Run specific test files

```bash
yarn test large/messages.test.ts      # Message stream delivery performance
yarn test large/syncs.test.ts         # Cold start sync performance testing
yarn test large/membership.test.ts    # Member addition notification testing
yarn test large/conversations.test.ts # New conversation notification delivery
yarn test large/metadata.test.ts      # Metadata update notification delivery
yarn test large/cumulative_syncs.test.ts # Progressive sync performance analysis
```

## Test Components

### Core Test Files

- **[conversations.test.ts](./conversations.test.ts)** - **Large Group Conversation Stream Performance**: Tests new conversation notification delivery times across multiple group sizes, verifying all workers receive notifications within acceptable time limits
- **[messages.test.ts](./messages.test.ts)** - **Large Group Message Delivery Performance**: Tests message stream delivery times with groups ranging from 5-10 members, verifying message delivery to all group members within acceptable time limits and stream consistency
- **[metadata.test.ts](./metadata.test.ts)** - **Large Group Metadata Stream Performance**: Tests group metadata update notification delivery times across different group sizes, verifying all workers receive group metadata update notifications within acceptable time
- **[syncs.test.ts](./syncs.test.ts)** - **Large Group Sync Performance**: Tests cold start sync times for group creation, syncAll, and individual sync operations, measuring performance impact of fresh synchronization
- **[cumulative_syncs.test.ts](./cumulative_syncs.test.ts)** - **Large Group Cumulative Sync Performance**: Tests progressive sync performance degradation as group database grows, measuring cumulative performance impact with growing conversation history
- **[membership.test.ts](./membership.test.ts)** - **Large Group Membership Stream Performance**: Tests group member addition notification delivery times across varying group sizes, verifying all workers receive membership update notifications within acceptable time
- **[helpers.ts](./helpers.ts)** - Shared utilities and test configuration

### Test Configuration

The suite uses configurable parameters in `helpers.ts`:

- `m_large_WORKER_COUNT` - Number of concurrent test workers (default: 5)
- `m_large_BATCH_SIZE` - Group size increment for testing (default: 5)
- `m_large_TOTAL` - Maximum group size to test (default: 10)

### Test Execution Pattern

Each test file follows a consistent pattern:

1. Creates groups of increasing sizes (batch increments from 5 to 10 members by default)
2. Measures specific performance metrics for each group size
3. Verifies that operations complete within acceptable time limits
4. Logs detailed timing results for analysis

## Performance Results

Results and timing summaries are automatically saved to `logs/large.log` after each test run.

### Message Stream Performance

Tests verify that all group members receive messages within acceptable time limits and maintain stream consistency across different group sizes.

### Sync Performance Metrics

| Operation Type                 | Description                                | Performance Focus                 |
| ------------------------------ | ------------------------------------------ | --------------------------------- |
| **Cold Start Group Creation**  | Fresh group creation with member additions | Initial setup performance         |
| **Cold Start SyncAll**         | Complete synchronization from clean state  | Full sync performance             |
| **Cold Start Individual Sync** | Single conversation sync from clean state  | Targeted sync performance         |
| **Cumulative SyncAll**         | Sync with growing conversation history     | Performance degradation over time |
| **Cumulative Individual Sync** | Individual sync with accumulated data      | Incremental sync impact           |

### Stream Notification Performance

| Stream Type              | What's Tested                         | Success Criteria                                     |
| ------------------------ | ------------------------------------- | ---------------------------------------------------- |
| **Conversation Streams** | New group creation notifications      | All workers receive notifications within time limits |
| **Message Streams**      | Message delivery across group members | Consistent delivery and stream integrity             |
| **Membership Streams**   | Member addition/removal notifications | Timely notification delivery to all participants     |
| **Metadata Streams**     | Group settings and info updates       | Reliable metadata propagation                        |

### Performance Benchmarks

Based on historical test data:

#### Sender-Side Performance

- **Message Sending**: 86-111ms (group sizes 50-400)
- **Group Creation**: 1.3s-7.6s (scales with group size)
- **Member Operations**: 135-320ms (updates and removals)

#### Receiver-Side Stream Performance

- **New Conversation Notifications**: 687ms-1.2s
- **Message Delivery**: 117-173ms
- **Membership Updates**: 401-609ms
- **Metadata Updates**: 141-214ms

#### Sync Performance

- **Cold Start SyncAll**: 366ms-1.3s
- **Individual Group Sync**: 291ms-1.3s

## Performance Recommendations

### Optimal Configuration

- **Groups ≤50 members**: Excellent performance across all operations
- **Groups 51-200 members**: Good performance, suitable for most use cases
- **Groups 201+ members**: Acceptable but monitor performance closely

### Key Monitoring Points

1. **Message Delivery Time**: Should remain under 200ms
2. **Sync Operations**: Cold start should complete within 1-2 seconds
3. **Stream Notifications**: All workers should receive updates within 1 second
4. **Cumulative Performance**: Watch for degradation as conversation history grows

## Key Files Reference

- **[conversations.test.ts](./conversations.test.ts)** - New conversation notification delivery testing
- **[messages.test.ts](./messages.test.ts)** - Message stream delivery performance and consistency
- **[syncs.test.ts](./syncs.test.ts)** - Cold start synchronization performance analysis
- **[membership.test.ts](./membership.test.ts)** - Member management notification testing
- **[metadata.test.ts](./metadata.test.ts)** - Group metadata update notification delivery
- **[cumulative_syncs.test.ts](./cumulative_syncs.test.ts)** - Progressive sync performance degradation analysis
- **[helpers.ts](./helpers.ts)** - Shared utilities, configuration, and logging functions
- **[README.md](./README.md)** - This comprehensive documentation
