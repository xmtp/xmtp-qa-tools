# Message Delivery & Performance Metrics Suite

This test suite measures message delivery reliability, performance benchmarks, and operational metrics for XMTP protocol operations across various scales and scenarios.

## What it does

- Measures message delivery reliability and ordering accuracy via streams vs polling
- Benchmarks execution time of core XMTP operations at various scales
- Tests offline recovery capabilities and message loss prevention
- Validates performance consistency across different group sizes
- Collects operational metrics for performance monitoring and analysis

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test against the corresponding network.

### Configuration Variables

- `DELIVERY_AMOUNT` - Number of messages to send for testing (default: 10)
- `DELIVERY_RECEIVERS` - Number of receiving clients (default: 4)
- `BATCH_SIZE` - Increment size for scaling tests (default: 5)
- `MAX_GROUP_SIZE` - Maximum group size to test (default: 10)

## How to run

### Run all metrics tests

```bash
yarn test metrics
```

### Run specific test files

```bash
yarn test metrics/delivery.test.ts    # Message delivery reliability tests
yarn test metrics/performance.test.ts # Performance benchmarking tests
```

### Run with custom parameters

```bash
# Delivery testing with custom parameters
DELIVERY_AMOUNT=20 DELIVERY_RECEIVERS=6 yarn test metrics/delivery.test.ts

# Performance testing with larger scales
BATCH_SIZE=10 MAX_GROUP_SIZE=50 yarn test metrics/performance.test.ts
```

## Test Components

### Delivery Testing (`delivery.test.ts`)

Measures message delivery reliability, ordering accuracy, and offline recovery capabilities across different message retrieval methods.

#### Test Scenarios

- **Stream Order Testing** - Verifies message delivery and ordering when receiving messages via real-time streams
- **Poll Order Testing** - Verifies message delivery and ordering when receiving messages via polling/pull method
- **Offline Recovery** - Tests message recovery after client disconnection and reconnection, ensuring no messages are lost

### Performance Benchmarking (`performance.test.ts`)

Benchmarks execution time of core XMTP operations including client management, conversation creation, and message handling at various scales.

#### Core Operations

- **Client Management**

  - `clientCreate` - Time to create and initialize new XMTP client
  - `canMessage` - Time to check if address can receive XMTP messages
  - `inboxState` - Time to retrieve current inbox state and installations

- **Direct Message Operations**

  - `newDm` - Time to create DM conversation using inbox ID
  - `newDmWithIdentifiers` - Time to create DM conversation using Ethereum address
  - `sendGM` - Time to send message in direct conversation
  - `receiveGM` - Time to receive and process message via streams

- **Group Operations**
  - `newGroup` - Time to create group conversation with multiple participants
  - `newGroupByIdentifiers` - Time to create group using Ethereum addresses
  - `syncGroup` - Time to synchronize group state and member list
  - `updateGroupName` - Time to update group metadata (name)
  - `sendGroupMessage` - Time to send message to group conversation
  - `receiveGroupMessage` - Time for all group members to receive message via streams
  - `addMembers` - Time to add new members to existing group
  - `removeMembers` - Time to remove members from group

#### Scale Testing

Each operation is tested across varying group sizes with batch scaling:

- **Variable Group Sizes**: Tests from minimal to maximum configured group size
- **Batch Increments**: Performance measured at regular batch size intervals
- **Scale Analysis**: Identifies performance degradation patterns as scale increases

#### Example Scale Tests

- `newGroup-{size}` - Group creation time with varying participant counts
- `syncGroup-{size}` - Group sync time at different scales
- `sendGroupMessage-{size}` - Message sending time in groups of varying sizes
- `receiveGroupMessage-{size}` - Message reception time across different group sizes

## Metrics Collection

Results include comprehensive timing data for:

- **Operation latency** across different scales
- **Message delivery success rates**
- **Stream vs polling performance comparison**
- **Offline recovery success metrics**
- **Scale-dependent performance degradation**

## Key Files

- **[delivery.test.ts](./delivery.test.ts)** - Message delivery reliability and ordering tests
- **[performance.test.ts](./performance.test.ts)** - Core operation performance benchmarking
- **[README.md](./README.md)** - This documentation
