# XMTP Group Performance Testing Suite (TS_Groups)

This test suite specifically focuses on measuring XMTP network performance with large groups, providing critical insights into group messaging scalability and responsiveness.

## Test Environment

- **Workers**: 10 workers configured for group performance testing
- **Batch Size**: Configurable (default: 50 participants per batch)
- **Maximum Group Size**: Configurable (default: 400 participants)
- **Metrics**: Automated performance data collection for large group operations

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
BATCH_SIZE=50  # Number of participants to add in each batch for group tests
MAX_GROUP_SIZE=400  # Maximum group size to test
XMTP_ENV=production  # Options: production, dev
```

## Test Execution

```bash
yarn test ts_groups
```

## Test Flow

The test suite incrementally increases group size by the batch size (default: 50) up to the maximum size (default: 400), running the following tests for each group size:

1. **Large Group Creation**:

   - Creates groups with increasing numbers of participants
   - Verifies group creation success and member count

2. **Conversation Stream Testing**:

   - Tests conversation stream functionality with newly created large groups
   - Measures stream initialization and event propagation performance

3. **Group Metadata Updates**:

   - Tests group metadata update operations (name changes)
   - Measures update propagation across all group members
   - Evaluates stream performance for metadata changes

4. **Group Messaging Performance**:
   - Measures message sending in large groups
   - Evaluates message reception across all group members
   - Tests scalability of message delivery with increasing group sizes

## Performance Metrics

### Group Operations Performance by Size

| Size | Create(ms) | Send(ms) | Sync(ms) | Update(ms) | Remove(ms) | Target(Create) | Status               |
| ---- | ---------- | -------- | -------- | ---------- | ---------- | -------------- | -------------------- |
| 50   | 3923.97    | 0.59     | 601.76   | 284.22     | 313.00     | <1400ms        | ❌ Performance Issue |
| 100  | 6678.58    | 0.78     | 1164.88  | 207.66     | 228.00     | <1400ms        | ❌ Performance Issue |

### Group Operations Performance - Receiver Side

| Size | Receive Sync(ms) | Msg Stream(ms) | Conv Stream(ms) | Update Stream(ms) | Installations | Target(Sync) | Status               |
| ---- | ---------------- | -------------- | --------------- | ----------------- | ------------- | ------------ | -------------------- |
| 50   | 601.76           | 0.59           | 880.37          | 284.22            | 51            | <100ms       | ❌ Performance Issue |
| 100  | 1164.88          | 0.78           | 3719.41         | 207.66            | 101           | <100ms       | ❌ Performance Issue |

_Note: Performance increases significantly beyond `350` members, with `400` members representing a hard limit on the protocol._
