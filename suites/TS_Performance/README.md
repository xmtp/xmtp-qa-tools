# XMTP Performance Testing Suite (TS_Performance)

This test suite comprehensively measures XMTP network performance across various operations, providing critical insights into system scalability and responsiveness.

## Test Environment

- **Workers**: Multiple workers configured for performance testing
- **Batch Size**: Configurable via environment variables
- **Group Size**: Configurable via environment variables
- **Metrics**: Automated performance data collection for each operation

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Configuration

Create a `.env` file in the root directory with your testing configuration:

```bash
BATCH_SIZE=5  # Number of participants to add in each batch for group tests
MAX_GROUP_SIZE=10  # Maximum group size to test
XMTP_ENV=production  # Options: production, dev
```

## Test Execution

```bash
yarn test ts_performance
```

## Test Flow

1. **Client Operations**:

   - Measures client creation performance
   - Tests canMessage functionality
   - Evaluates inbox state retrieval speeds

2. **Direct Messaging**:

   - Tests DM creation by inbox ID
   - Tests DM creation by identifier
   - Measures message sending latency
   - Evaluates message reception performance

3. **Group Operations**:
   - Tests group creation with varying member counts (increasing by batch size)
   - Tests group creation with identifiers
   - Measures group syncing performance
   - Evaluates group metadata updates (name, description, etc.)
   - Tests member management operations (add/remove)
   - Measures message sending in groups of various sizes
   - Evaluates message reception in groups

## Performance Metrics

The suite automatically records performance metrics for each operation:

- Execution time for all API operations
- Scalability measurements with increasing group sizes
- Message delivery latency in different contexts

## Key Features Tested

- Client initialization performance
- Conversation creation speed
- Member management efficiency
- Group synchronization performance
- Message delivery latency across different group sizes
- SDK performance under varying load conditions

## Monitoring

Performance metrics feed into the [SDK Performance Dashboard](https://app.datadoghq.com/dashboard/9z2-in4-3we/), which visualizes operation durations, network performance, and scalability indicators.
