# XMTP Group Performance Testing Suite (TS_Large)

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
yarn test TS_Large
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

The test suite measures performance across different group sizes. Here are the observed metrics:
