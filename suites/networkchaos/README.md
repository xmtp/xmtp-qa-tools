# Network chaos testing

Validates XMTP protocol resilience under adverse network conditions using local 4-node XMTP-go cluster with simulated network partitions, delays, and failures.

## Environment requirements

```bash
# Docker setup required
docker --version

# Passwordless sudo required for network manipulation
sudo iptables --version

# Local 4-node cluster must be running
cd multinode && ./up
```

## Test infrastructure

**Environment**: Local 4-node cluster with simulated network conditions
**Cluster nodes**: `multinode-node1-1`, `multinode-node2-1`, `multinode-node3-1`, `multinode-node4-1`
**API endpoints**: `localhost:5556`, `localhost:6556`, `localhost:7556`, `localhost:8556`

## Basic connectivity validation [smoketests.test.ts](smoketests.test.ts)

**Purpose**: Validates fundamental network manipulation tools and basic connectivity.

### Core tests:

- `add and remove 200ms latency between node1 and node2`
- `block and restore traffic between node1 and node4`

**Measurements**:

- Network manipulation tool functionality
- Basic ping connectivity verification

## DM duplicate prevention [dm-duplicate-prevention.test.ts](dm-duplicate-prevention.test.ts)

**Purpose**: Validates message deduplication in direct messages under retry scenarios and degraded network conditions.

### Chaos scenarios:

```typescript
// Network conditions applied
const delay = Math.floor(400 + Math.random() * 200); // 400-600ms
const jitter = Math.floor(Math.random() * 100); // 0-100ms
const loss = Math.random() * 5; // 0-5%
```

### Core test:

- `not deliver duplicate DMs under retry and degraded network conditions`

**Measurements**:

- Message deduplication effectiveness
- Retry mechanism resilience

## Group partition recovery [group-partition-delayedreceive.test.ts](group-partition-delayedreceive.test.ts)

**Purpose**: Tests group message delivery during network partitions and recovery after partition ends.

### Core test:

- `verify group messaging with partitioning`

**Workflow**:

1. Create 4-member group
2. Isolate node2 from nodes 1/3/4
3. Send messages during partition
4. Restore connectivity
5. Verify message delivery recovery

**Measurements**:

- Message delivery resilience during partition
- Recovery time after network restoration
- Message ordering consistency

## Group state reconciliation [group-reconciliation.test.ts](group-reconciliation.test.ts)

**Purpose**: Validates group state consistency and member sync after network isolation.

### Core test:

- `recover and sync group state after node isolation`

**Workflow**:

1. Create initial 3-member group
2. Isolate node3 from cluster
3. Add new member during isolation
4. Restore network connectivity
5. Verify group state synchronization

**Measurements**:

- Group state consistency after partition
- Member addition propagation
- State reconciliation effectiveness

## Node blackhole simulation [node-blackhole.test.ts](node-blackhole.test.ts)

**Purpose**: Tests behavior when nodes become completely unreachable.

### Core test:

- `simulate a node blackhole in a group chat and recover cleanly`

**Workflow**:

1. Create group conversation
2. Apply blackhole isolation on node2
3. Send messages from isolated node
4. Verify message isolation
5. Lift blackhole and verify recovery

**Measurements**:

- Message isolation effectiveness
- Recovery behavior after blackhole removal
- Message ordering post-recovery

## Client partition behavior [group-client-partition.test.ts](group-client-partition.test.ts)

**Purpose**: Tests client behavior during network partitions using host-level traffic blocking.

### Core test:

- `verify group messaging during and after client-side blackhole partition`

**Implementation**:

```typescript
// Block host traffic to specific port
iptables.blockHostPort(partitionPort);

// Restore connectivity
iptables.unblockHostPort(partitionPort);
```

**Measurements**:

- Client-side partition handling
- Message delivery during isolation
- Reconnection and sync behavior

## Comprehensive network chaos [networkchaos.test.ts](networkchaos.test.ts)

**Purpose**: Sustained network disruption testing with concurrent message traffic.

### Chaos parameters:

```typescript
const delay = Math.floor(100 + Math.random() * 400); // 100-500ms
const jitter = Math.floor(Math.random() * 100); // 0-100ms
const loss = Math.random() * 5; // 0-5%
```

### Core test:

- `survive sustained latency + jitter + packet loss under group message load`

**Environment**: 20 users distributed across 4 nodes
**Duration**: 60 seconds of sustained chaos
**Traffic**: Concurrent message flooding from all users

**Measurements**:

- System resilience under sustained chaos
- Message delivery percentage
- Fork detection and resolution

## Key rotation stress testing [keyrotation.test.ts](keyrotation.test.ts)

**Purpose**: Validates key rotation mechanisms under network stress and sustained traffic.

### Concurrent operations:

- **Message traffic**: Continuous message sending from all users
- **Key rotation**: Periodic member removal/addition every 10 seconds
- **Network chaos**: Latency, jitter, and packet loss injection
- **Fork detection**: Real-time group state validation

### Core test:

- `handle staggered key rotations and network chaos under load`

**Environment**: 20 users with random node distribution
**Duration**: 60 seconds of concurrent stress operations

**Measurements**:

- Key rotation success under network stress
- Epoch progression consistency
- Message delivery during key changes
- Group state integrity validation

## Network manipulation tools

### Docker container operations:

```typescript
const node = new DockerContainer("multinode-node1-1");

// Latency and jitter
node.addJitter(delay, jitter);
node.addLatency(200);
node.clearLatency();

// Packet loss
node.addLoss(5.0);

// Traffic blocking
node.blockOutboundTrafficTo(targetNode);
node.unblockOutboundTrafficTo(targetNode);

// Blackhole simulation
node.simulateBlackhole([node1, node3, node4]);
node.clearBlackhole([node1, node3, node4]);
```

### Host-level traffic control:

```typescript
// Port-based blocking
iptables.blockHostPort(6556);
iptables.unblockHostPort(6556);
```

## Test execution

```bash
# Run all network chaos tests
npm test suites/networkchaos

# Run specific test
npm test suites/networkchaos/smoketests.test.ts

# Local cluster setup required
cd multinode && ./up
```

## Performance expectations

| Test category        | Expected outcome | Tolerance                       |
| -------------------- | ---------------- | ------------------------------- |
| Basic connectivity   | On Target        | Complete success                |
| DM deduplication     | On Target        | Single message delivery         |
| Group partitions     | On Target        | Full message recovery           |
| State reconciliation | On Target        | Complete member sync            |
| Node blackhole       | On Target        | Clean isolation/recovery        |
| Client partitions    | On Target        | Message delivery post-reconnect |
| Network chaos        | On Target        | 100% delivery under stress      |
| Key rotation         | On Target        | Successful rotation under load  |
