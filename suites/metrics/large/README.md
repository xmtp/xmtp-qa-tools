# Large-Scale Performance Testing Suite

This unified test suite benchmarks XMTP protocol performance and scalability with large group conversations, providing comprehensive metrics for enterprise-scale deployments in a single, efficient test file.

## What it does

- **Message Delivery Performance**: Tests message stream delivery times with groups ranging from baseline 10-person to configured max size
- **Sync Performance Analysis**: Measures cold start sync times for group creation, syncAll, and individual sync operations
- **Conversation Stream Testing**: Evaluates new conversation notification delivery times across multiple group sizes
- **Cumulative Sync Impact**: Tests progressive sync performance degradation as group database grows
- **Membership Management**: Benchmarks group member addition notification delivery times across varying group sizes
- **Metadata Updates**: Analyzes group metadata update notification delivery times across different group sizes

## Architecture

The test suite is now consolidated into a single file (`suites/metrics/large.test.ts`) that efficiently manages all test types with shared worker pools, eliminating the previous limitation of one stream per worker.

### Test Structure

- **Baseline Tests**: Always run 10-person group tests first (independent of batch configuration)
- **Batch Tests**: Run variable group sizes based on `BATCH_SIZE` and `MAX_GROUP_SIZE` configuration
- **Unified Logging**: All metrics are collected in a single summary with clear baseline identification

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test against the corresponding network.

## How to run

### Run the complete large-scale test suite

```bash
yarn test large
```

### Run with specific configuration

```bash
BATCH_SIZE=25 MAX_GROUP_SIZE=100 WORKER_COUNT=10 yarn test large
```

### Run with debug logging

```bash
yarn test large --debug --no-fail
```

## Test Configuration

The suite uses configurable parameters:

- `WORKER_COUNT` - Number of concurrent test workers (default: 5)
- `BATCH_SIZE` - Group size increment for testing (default: 5)
- `MAX_GROUP_SIZE` - Maximum group size to test (default: 10)

### Baseline Testing

Every test run starts with dedicated 10-person group baseline tests, independent of the batch configuration. This ensures consistent measurement of a standardized group size regardless of how `BATCH_SIZE` and `MAX_GROUP_SIZE` are configured. Baseline tests are clearly marked in the performance logs with `[BASELINE]` for easy identification.

### Test Execution Pattern

The unified test suite follows this pattern:

1. **Baseline Tests**: Creates dedicated 10-person group tests for all test types (messages, conversations, membership, metadata, syncs)
2. **Batch Tests**: Creates groups of increasing sizes based on batch configuration
3. **Comprehensive Coverage**: Each group size tests all performance aspects (streams, syncs, etc.)
4. **Unified Metrics**: All results are collected in a single summary with baseline measurements clearly marked
5. **Efficient Resource Management**: Shared worker pools across all test types

## Performance Results

Results and timing summaries are automatically saved to `logs/large.log` after each test run with comprehensive metrics for all test types.

### Measured Performance Metrics

| Metric Type                    | Description                                | Baseline | Batch Tests |
| ------------------------------ | ------------------------------------------ | -------- | ----------- |
| **Message Stream Performance** | Message delivery across group members      | ✅       | ✅          |
| **Conversation Streams**       | New group creation notifications           | ✅       | ✅          |
| **Membership Streams**         | Member addition/removal notifications      | ✅       | ✅          |
| **Metadata Streams**           | Group settings and info updates            | ✅       | ✅          |
| **Cold Start Group Creation**  | Fresh group creation with member additions | ✅       | ✅          |
| **Cold Start SyncAll**         | Complete synchronization from clean state  | ✅       | ✅          |
| **Cold Start Individual Sync** | Single conversation sync from clean state  | ✅       | ✅          |
| **Cumulative SyncAll**         | Sync with growing conversation history     | ✅       | ✅          |
| **Cumulative Individual Sync** | Individual sync with accumulated data      | ✅       | ✅          |

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

## Benefits of Unified Architecture

✅ **Single Test File**: All functionality consolidated for easier maintenance  
✅ **Efficient Resource Usage**: Shared worker pools across all test types  
✅ **No Stream Limitations**: Multiple streams per worker now supported  
✅ **Comprehensive Metrics**: All performance aspects measured in one run  
✅ **Consistent Baseline**: Always get standardized 10-person measurements  
✅ **Clear Organization**: Baseline and batch tests clearly separated

## Key File Reference

- **[large.test.ts](../large.test.ts)** - Unified comprehensive test suite covering all performance aspects
- **[README.md](./README.md)** - This documentation

## Migration Notes

This suite has been consolidated from multiple separate test files into a single efficient implementation. The previous separation was due to a limitation of one stream per worker, which has been resolved.
