# Metrics Test Suite

Performance and delivery measurement tests for XMTP protocol operations. These tests measure execution times, message delivery rates, ordering accuracy, and system reliability under various conditions.

## Test 1 (Delivery)

Measures message delivery reliability, ordering accuracy, and offline recovery capabilities across different message retrieval methods.

- `stream_order` - Verifies message delivery and ordering when receiving messages via real-time streams
- `poll_order` - Verifies message delivery and ordering when receiving messages via polling/pull method
- `offline_recovery` - Tests message recovery after a client disconnects and reconnects, ensuring no messages are lost

## Test 2 (Performance)

Benchmarks the execution time of core XMTP operations including client management, conversation creation, and message handling at various scales.

- `clientCreate` - Measures time to create and initialize a new XMTP client
- `canMessage` - Measures time to check if an address can receive XMTP messages
- `inboxState` - Measures time to retrieve current inbox state and installations
- `newDm` - Measures time to create a new direct message conversation using inbox ID
- `newDmWithIdentifiers` - Measures time to create a new direct message conversation using Ethereum address
- `sendGM` - Measures time to send a message in a direct conversation
- `receiveGM` - Measures time to receive and process a message via streams
- `newGroup` - Measures time to create a group conversation with multiple participants
- `newGroupByIdentifiers` - Measures time to create a group using Ethereum addresses instead of inbox IDs
- `syncGroup` - Measures time to synchronize group state and member list
- `updateGroupName` - Measures time to update group metadata (name)
- `sendGroupMessage` - Measures time to send a message to a group conversation
- `receiveGroupMessage` - Measures time for all group members to receive a message via streams
- `addMembers` - Measures time to add new members to an existing group
- `removeMembers` - Measures time to remove members from a group
- `newGroup-{size}` - Measures group creation time with varying participant counts (batch scaling)
- `newGroupByIdentifiers-{size}` - Measures group creation by address with varying participant counts
- `syncGroup-{size}` - Measures group sync time at different scales
- `updateGroupName-{size}` - Measures group name updates at different scales
- `removeMembers-{size}` - Measures member removal time at different scales
- `sendGroupMessage-{size}` - Measures message sending time in groups of varying sizes
- `receiveGroupMessage-{size}` - Measures message reception time across different group sizes

## How to Run

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
# Run all metrics tests
yarn test suites/metrics

# Run specific test files
yarn test suites/metrics/delivery.test.ts
yarn test suites/metrics/performance.test.ts

# Run with custom environment variables
DELIVERY_AMOUNT=20 DELIVERY_RECEIVERS=6 yarn test suites/metrics/delivery.test.ts
BATCH_SIZE=10 MAX_GROUP_SIZE=50 yarn test suites/metrics/performance.test.ts
```

### Environment Variables

**Delivery Tests:**

- `DELIVERY_AMOUNT` - Number of messages to send for testing (default: 10)
- `DELIVERY_RECEIVERS` - Number of receiving clients (default: 4)

**Performance Tests:**

- `BATCH_SIZE` - Increment size for scaling tests (default: 5)
- `MAX_GROUP_SIZE` - Maximum group size to test (default: 10)
