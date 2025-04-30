# XMTP Stress Testing Suite (TS_Stress)

This test suite evaluates XMTP's performance and reliability under high load conditions by creating multiple conversations, large groups, and sending numerous messages simultaneously.

## Test Environment

- **Workers**: Configurable number of test workers (based on test size)
- **Test Sizes**: Configurable test sizes (small, medium, large) with different parameters
- **Target**: Fixed receiver for measuring consistent performance
- **Metrics**: Automated performance data collection for stress scenarios

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
XMTP_ENV=production  # Options: production, dev
STRESS_SIZE=small  # Options: small, medium, large
```

## Test Execution

```bash
yarn test ts_stress
```

## Test Flow

1. **Direct Message Stress Testing**:

   - Creates numerous DM conversations between workers and a target receiver
   - Sends configurable number of messages in each conversation
   - Measures performance under multi-conversation load

2. **Small Group Stress Testing**:

   - Creates multiple small groups with worker members
   - Sends messages within each group simultaneously
   - Evaluates group creation and message delivery under moderate load

3. **Large Group Stress Testing**:
   - Creates large groups with many members (size based on configuration)
   - Tests the limits of group creation and management
   - Measures performance degradation with increasing group size

## Test Size Configurations

The test supports different stress levels:

- **Small**: Lower worker count, fewer messages, smaller groups
- **Medium**: Moderate worker count, message volume, and group sizes
- **Large**: High worker count, message volume, and large groups

## Performance Metrics

The suite automatically records performance metrics for each operation:

- Execution time for conversation creation
- Message sending performance under load
- Group creation and management efficiency at scale
- System stability under stress conditions

## Key Features Tested

- Conversation creation under high concurrency
- Message delivery reliability at scale
- Group management with large member counts
- System resource utilization under stress
- Error handling and recovery during high load
- Overall system stability during peak usage scenarios
