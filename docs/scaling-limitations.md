# Scaling limitations

Let's be honest about where we hit walls when testing XMTP at scale. These are the real constraints we're working with right now.

## What we can test today

### Group size limitations

**Current Maximum**: 400 members per group
**Achieved Performance**: 95% message delivery rate

```typescript
// Current group scaling test configuration
const SCALE_TEST_CONFIG = {
  maxGroupSize: 400,
  targetDeliveryRate: 0.95,
  maxCreationTime: 60000, // 1 minute
  maxMessageDeliveryTime: 45000, // 45 seconds
};
```

**Where we hit walls**:

- **Memory usage**: Each new member adds more memory overhead, and it adds up fast
- **Connection overhead**: Every member needs their own persistent connection
- **Message fan-out**: The bigger the group, the longer it takes to deliver to everyone
- **Network congestion**: Large groups just create more opportunities for things to fail

### Infrastructure constraints

#### Compute resources

**GitHub Actions Limitations**:

- **CPU**: 2-core virtual machines limit concurrent client simulation
- **Memory**: 7GB RAM restricts the number of simultaneous XMTP clients
- **Network**: Shared network bandwidth affects multi-region testing
- **Time Limits**: 6-hour maximum runtime for long-running scale tests

```yaml
# Current GitHub Actions resource constraints
jobs:
  large-scale-test:
    runs-on: ubuntu-latest # 2 CPU, 7GB RAM
    timeout-minutes: 360 # 6 hour limit
    strategy:
      matrix:
        group-size: [10, 50, 100, 400] # Limited by available resources
```

**Railway Deployment Constraints**:

- **Service Limits**: Limited number of concurrent bot deployments
- **Resource Allocation**: Shared resources across multiple test agents
- **Connection Limits**: Network connection pools restrict concurrent clients

#### Multi-region bottlenecks

**Geographic Distribution**:
Current testing is primarily focused on US-East region due to:

- **Cost Constraints**: Multi-region infrastructure increases testing costs
- **Complexity**: Coordinating tests across multiple regions
- **Latency Variables**: Inconsistent performance across regions

**Identified Regional Issues**:

- **EU-West Performance**: 15-20% higher latency than US-East
- **Asia-Pacific Limitations**: Limited testing coverage
- **Cross-Region Reliability**: 5-10% lower delivery rates

### Network performance constraints

#### Bandwidth limitations

**Test Environment Network**:

- **Shared Bandwidth**: Multiple test suites compete for network resources
- **Peak Usage Impact**: Performance degrades during high-activity periods
- **Throttling**: Network rate limiting affects large-scale tests

**Real-World Simulation Gaps**:

- **Mobile Networks**: Limited simulation of 3G/4G/5G conditions
- **Unreliable Connections**: Difficulty simulating network instability
- **Proxy/VPN Impact**: Corporate network conditions not well tested

#### Connection management

**WebSocket Limitations**:

```typescript
// Current WebSocket connection constraints
const CONNECTION_LIMITS = {
  maxConcurrentConnections: 1000,
  connectionPoolSize: 50,
  heartbeatInterval: 30000,
  reconnectAttempts: 3,
};
```

**Observed Issues**:

- **Connection Storms**: Simultaneous connections cause bottlenecks
- **Resource Exhaustion**: File descriptor limits with many clients
- **Connection Recovery**: Slow reconnection in large-scale scenarios

## Performance degradation patterns

### Linear scaling issues

#### Message delivery performance

Performance degrades predictably with group size:

| Group Size  | Avg Delivery Time | Success Rate | Memory Usage |
| ----------- | ----------------- | ------------ | ------------ |
| 10 members  | 2.1 seconds       | 99.9%        | 45MB         |
| 50 members  | 8.7 seconds       | 99.5%        | 180MB        |
| 100 members | 18.3 seconds      | 99.0%        | 350MB        |
| 400 members | 42.8 seconds      | 95.0%        | 1.2GB        |

**Scaling Formula**:

```typescript
// Observed performance scaling
const estimateDeliveryTime = (memberCount: number): number => {
  // Base time + (members * scaling factor)
  return 2000 + memberCount * 100; // milliseconds
};

const estimateMemoryUsage = (memberCount: number): number => {
  // Base usage + linear growth per member
  return 45 + memberCount * 3; // MB
};
```

### Exponential complexity areas

#### Cryptographic operations

**Key Package Management**:

- Key generation scales linearly with group size
- Signature verification increases with message volume
- Encryption overhead grows with recipient count

**Performance Impact**:

```typescript
// Cryptographic operation scaling
const cryptoOperationTime = {
  keyGeneration: (members: number) => members * 50, // ms per member
  signatureVerification: (messages: number) => messages * 10, // ms per message
  encryptionOverhead: (recipients: number) => Math.log2(recipients) * 100, // ms
};
```

## Resource utilization analysis

### Memory consumption patterns

**Client Memory Usage**:

```typescript
interface MemoryProfile {
  baseClient: 25; // MB - Minimum client memory
  perConversation: 0.5; // MB - Each conversation adds
  perMessage: 0.001; // MB - Each message in history
  perGroupMember: 0.1; // MB - Each group member
  streamingOverhead: 5; // MB - Real-time streaming
}
```

**Memory Leak Detection**:

- Long-running tests show gradual memory increase
- Group operations exhibit temporary memory spikes
- Stream handling has potential for memory leaks

### CPU utilization bottlenecks

**Processing Hotspots**:

- **Message Serialization**: 15-20% of CPU time in large groups
- **Network I/O**: 25-30% of CPU during high message volume
- **Cryptographic Operations**: 35-40% of CPU for key operations

### Storage constraints

**Local Storage Limitations**:

- **Message History**: Unlimited retention impacts performance
- **Client State**: Large groups create significant state storage
- **Temporary Files**: Test artifacts accumulate during long runs

## Known issues and workarounds

### Issue 1: Group creation timeout

**Problem**: Groups with >300 members sometimes fail to create within timeout period.

**Symptoms**:

```bash
Error: Group creation timeout after 60000ms
  at GroupCreationTimeout (suites/metrics/large.test.ts:127)
  Group size: 350 members
  Attempted retries: 3
```

**Current Workaround**:

```typescript
// Extended timeout for large groups
const createLargeGroup = async (members: string[]) => {
  const timeout = Math.max(60000, members.length * 200); // Dynamic timeout
  return await client.conversations.newGroup(members, { timeout });
};
```

**Related Issues**:

- [Issue #1023: Group creation timeout scaling](https://github.com/xmtp/xmtp-qa-tools/issues/1023)
- [Issue #1024: Memory optimization for large groups](https://github.com/xmtp/xmtp-qa-tools/issues/1024)

### Issue 2: Cross-region delivery degradation

**Problem**: Message delivery rates drop significantly in cross-region scenarios.

**Impact**:

- US-East to EU-West: 92% delivery rate (vs 99% target)
- US-East to Asia-Pacific: 88% delivery rate
- Multi-hop routing adds 3-5 second latency

**Current Workaround**:

- Region-specific SLO targets
- Extended timeout values for cross-region tests
- Retry mechanisms for failed deliveries

**Related Issues**:

- [Issue #1025: Multi-region performance optimization](https://github.com/xmtp/xmtp-qa-tools/issues/1025)
- [Issue #1026: Cross-region SLO adjustment](https://github.com/xmtp/xmtp-qa-tools/issues/1026)

### Issue 3: Resource exhaustion in CI

**Problem**: GitHub Actions runs fail due to resource limits during large-scale tests.

**Error Pattern**:

```bash
Error: spawn EMFILE
  at ChildProcess.spawn (child_process.js:313)
  at Object.spawn (child_process.js:243)
  Maximum clients reached: 847
```

**Current Workaround**:

```typescript
// Resource-aware test execution
const MAX_CONCURRENT_CLIENTS = process.env.CI ? 500 : 1000;
const clientPool = new ClientPool({ maxSize: MAX_CONCURRENT_CLIENTS });
```

**Related Issues**:

- [Issue #1027: CI resource optimization](https://github.com/xmtp/xmtp-qa-tools/issues/1027)
- [Issue #1028: Client pool management](https://github.com/xmtp/xmtp-qa-tools/issues/1028)

## Current monitoring

### Scale test metrics

**Key performance indicators**:

```typescript
interface ScaleTestMetrics {
  maxGroupSize: number;
  deliveryRate: number;
  averageLatency: number;
  peakMemoryUsage: number;
  cpuUtilization: number;
  networkThroughput: number;
  errorRate: number;
}
```

#### Resource monitoring example

```typescript
// Monitor resource usage during tests
test("Monitor memory during large group test", async () => {
  const group = await createGroup(400);

  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  await group.send("Test message to large group");
  await group.sync();

  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryDelta = finalMemory - initialMemory;

  await submitMetric("xmtp.test.memory_usage", finalMemory, {
    group_size: 400,
    operation: "large_group_send",
  });

  expect(memoryDelta).toBeLessThan(500); // MB increase limit
});
```

## References

### Related GitHub issues

- [Issue #1012: Benchmarks recorded periodically](https://github.com/xmtp/xmtp-qa-tools/issues/1012)
- [Issue #1023: Group creation timeout scaling](https://github.com/xmtp/xmtp-qa-tools/issues/1023)
- [Issue #1024: Memory optimization for large groups](https://github.com/xmtp/xmtp-qa-tools/issues/1024)
- [Issue #1025: Multi-region performance optimization](https://github.com/xmtp/xmtp-qa-tools/issues/1025)
- [Issue #1026: Cross-region SLO adjustment](https://github.com/xmtp/xmtp-qa-tools/issues/1026)
- [Issue #1027: CI resource optimization](https://github.com/xmtp/xmtp-qa-tools/issues/1027)
- [Issue #1028: Client pool management](https://github.com/xmtp/xmtp-qa-tools/issues/1028)

### Performance analysis resources

- [XMTP Network Status](https://status.xmtp.org/)
- [Datadog Performance Dashboard](https://app.datadoghq.com/dashboard/your-dashboard-id)
- [Railway Project Monitoring](https://railway.com/project/cc97c743-1be5-4ca3-a41d-0109e41ca1fd)
- [GitHub Actions Performance Logs](https://github.com/xmtp/xmtp-qa-tools/actions?query=event:schedule)
