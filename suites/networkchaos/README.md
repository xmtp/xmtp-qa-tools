# Network chaos testing

Validates XMTP protocol resilience under adverse network conditions using local 4-node XMTP-go cluster.

## Setup requirements

```bash
# Docker and passwordless sudo required
cd multinode && ./up
```

**Cluster nodes**: `multinode-node1-1` through `multinode-node4-1`
**API endpoints**: `localhost:5556`, `localhost:6556`, `localhost:7556`, `localhost:8556`

## Network chaos parameters

```typescript
// Standard chaos conditions
const delay = Math.floor(100 + Math.random() * 500); // 100-600ms
const jitter = Math.floor(Math.random() * 150); // 0-150ms
const loss = Math.random() * 5; // 0-5%
```

## Test categories

### Basic connectivity [smoketests.test.ts](smoketests.test.ts)

- `add and remove 200ms latency between node1 and node2`
- `block and restore traffic between node1 and node4`

### DM duplicate prevention [dm-duplicate-prevention.test.ts](dm-duplicate-prevention.test.ts)

- `not deliver duplicate DMs under retry and degraded network conditions`

### Group partition recovery [group-partition-delayedreceive.test.ts](group-partition-delayedreceive.test.ts)

- `verify group messaging with partitioning`

### Group state reconciliation [group-reconciliation.test.ts](group-reconciliation.test.ts)

- `recover and sync group state after node isolation`

### Node blackhole simulation [node-blackhole.test.ts](node-blackhole.test.ts)

- `simulate a node blackhole in a group chat and recover cleanly`

### Client partition behavior [group-client-partition.test.ts](group-client-partition.test.ts)

- `verify group messaging during and after client-side blackhole partition`

### Network chaos send [networkchaos.test.ts](networkchaos.test.ts)

- `survive sustained latency + jitter + packet loss under group message load`
- 20 users, 60 seconds sustained chaos

### Key rotation send [keyrotation.test.ts](keyrotation.test.ts)

- `handle staggered key rotations and network chaos under load`
- 20 users, concurrent operations: message traffic, key rotation, network chaos

## Network manipulation tools

```typescript
const node = new DockerContainer("multinode-node1-1");

// Chaos injection
node.addJitter(delay, jitter);
node.addLatency(200);
node.addLoss(5.0);
node.clearLatency();

// Isolation
node.blockOutboundTrafficTo(targetNode);
node.simulateBlackhole([node1, node3, node4]);
iptables.blockHostPort(6556);
```

## Test execution

```bash
npm test suites/networkchaos
cd multinode && ./up  # Setup required
```
