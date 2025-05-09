# XMTP Group Performance Testing Suite (TS_Groups)

This test suite specifically focuses on measuring XMTP network performance with large groups, providing critical insights into group messaging scalability and responsiveness.

## Setup

```bash
# Installation
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
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
| 50   | 1242.08    | 9.53     | 57.56    | 32.70      | 36.00      | <1400ms        | ✅ On Target         |
| 100  | 2987.76    | 41.76    | 23.72    | 154.93     | 170.00     | <1400ms        | ❌ Performance Issue |

### Group Operations Performance - Receiver Side

| Size | Receive Sync(ms) | Msg Stream(ms) | Conv Stream(ms) | Update Stream(ms) | Installations | Target(Sync) | Status       |
| ---- | ---------------- | -------------- | --------------- | ----------------- | ------------- | ------------ | ------------ |
| 50   | 57.56            | 9.53           | 13.37           | 32.70             | 206           | <100ms       | ✅ On Target |
| 100  | 23.72            | 41.76          | 131.04          | 154.93            | 403           | <100ms       | ✅ On Target |
