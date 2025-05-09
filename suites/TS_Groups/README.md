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

| Size | Create(ms) | Send(ms) | Sync(ms) | Update(ms) | Remove(ms) | Target(Create) | Status |
| ---- | ---------- | -------- | -------- | ---------- | ---------- | -------------- | ------ |
| 50 | 1270.55 | 5.96 | 24.48 | 54.38 | 60.00 | <1400ms | ✅ On Target |
| 100 | 2997.06 | 14.57 | 22.64 | 144.90 | 159.00 | <1400ms | ❌ Performance Issue |







### Group Operations Performance - Receiver Side

| Size | Receive Sync(ms) | Msg Stream(ms) | Conv Stream(ms) | Update Stream(ms) | Installations | Target(Sync) | Status |
| ---- | --------------- | -------------- | --------------- | ---------------- | ------------- | ------------ | ------ |
| 50 | 24.48 | 5.96 | 36.67 | 54.38 | 206 | <100ms | ✅ On Target |
| 100 | 22.64 | 14.57 | 19352.95 | 144.90 | 406 | <100ms | ✅ On Target |







_Note: Performance increases significantly beyond `350` members, with `400` members representing a hard limit on the protocol._
