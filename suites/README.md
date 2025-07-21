# Test Suites

End-to-end test suites for XMTP protocol validation across environments and scenarios.

## Quick Reference

| Suite                           | Purpose                          | Command                  |
| ------------------------------- | -------------------------------- | ------------------------ |
| [functional](./functional/)     | Core protocol functionality      | `yarn test functional`   |
| [metrics](./metrics/)           | Performance and delivery testing | `yarn test metrics`      |
| [agents](./agents/)             | Production agent monitoring      | `yarn test agents`       |
| [bench](./bench/)               | Performance benchmarking         | `yarn test bench`        |
| [networkchaos](./networkchaos/) | Network partition testing        | `yarn test networkchaos` |
| [other](./other/)               | Edge cases and specialized tests | `yarn test other`        |
| [bugs](./bugs/)                 | Bug reproduction and tracking    | `yarn test bugs`         |
| [forks](./forks/)               | Git commit-based testing         | `yarn test forks`        |

## Core Functionality

### Functional Tests

Complete protocol feature validation.

```bash
yarn test functional
yarn test functional --versions 3  # Multi-version testing
```

**Individual Tests:**

```bash
yarn test suites/functional/dms.test.ts          # Direct messaging
yarn test suites/functional/groups.test.ts       # Group conversations
yarn test suites/functional/streams.test.ts      # Message streaming
yarn test suites/functional/sync.test.ts         # Data synchronization
yarn test suites/functional/consent.test.ts      # Permission management
yarn test suites/functional/clients.test.ts      # Client lifecycle
yarn test suites/functional/installations.test.ts # Multi-device support
yarn test suites/functional/callbacks.test.ts    # Event handling
yarn test suites/functional/metadata.test.ts     # Conversation metadata
yarn test suites/functional/offline.test.ts      # Offline handling
yarn test suites/functional/order.test.ts        # Message ordering
yarn test suites/functional/codec.test.ts        # Content encoding
yarn test suites/functional/browser.test.ts      # Browser integration
yarn test suites/functional/regression.test.ts   # Regression prevention
```

## Performance Testing

### Metrics Suite

Performance measurement and delivery validation.

```bash
yarn test metrics
```

**Individual Tests:**

```bash
yarn test suites/metrics/performance.test.ts     # Performance metrics
yarn test suites/metrics/delivery.test.ts        # Message delivery
yarn test suites/metrics/large.test.ts          # Large-scale testing
```

### Benchmarking

Throughput and latency measurement.

```bash
yarn test bench
```

## Production Monitoring

### Agent Health

Live production agent validation.

```bash
yarn test agents
XMTP_ENV=production yarn test agents --no-fail --debug
```

**Individual Tests:**

```bash
yarn test suites/agents/agents-dms.test.ts       # DM functionality
yarn test suites/agents/agents-tagged.test.ts    # Tagged agents
yarn test suites/agents/agents-untagged.test.ts  # Untagged agents
```

## Network Testing

### Network Chaos

Network partition and failure scenarios.

```bash
yarn test networkchaos
```

**Individual Tests:**

```bash
yarn test suites/networkchaos/group-reconciliation.test.ts
yarn test suites/networkchaos/dm-duplicate-prevention.test.ts
yarn test suites/networkchaos/group-client-partition.test.ts
yarn test suites/networkchaos/keyrotation.test.ts
yarn test suites/networkchaos/node-blackhole.test.ts
yarn test suites/networkchaos/smoketests.test.ts
```

## Specialized Testing

### Edge Cases

Rate limiting, storage, and specialized scenarios.

```bash
yarn test other
```

**Individual Tests:**

```bash
yarn test suites/other/mobile.test.ts           # Mobile performance
yarn test suites/other/storage.test.ts          # Storage efficiency
yarn test suites/other/spam.test.ts             # Spam detection
yarn test suites/other/notifications.test.ts    # Push notifications
yarn test suites/other/rate-limited.test.ts     # Rate limiting
yarn test suites/other/fullinbox.test.ts        # Full inbox scenarios
yarn test suites/other/chaos.test.ts            # Chaos testing
yarn test suites/other/nodetest.test.ts         # Node testing
```

### Bug Reproduction

Historical bug tracking and regression testing.

```bash
yarn test bugs
```

**Bug Categories:**

- `addmember/` - Group membership issues
- `kpke/` - Key package encryption errors
- `panic/` - System crash conditions
- `stitch/` - Message continuity problems

### Commit Testing

Git commit-based validation.

```bash
yarn test forks
```

## Running Tests

### Basic Execution

```bash
# Run test suites
yarn test functional
yarn test metrics
yarn test agents
yarn bench

# Run individual files
yarn test suites/functional/dms.test.ts
yarn test suites/metrics/performance.test.ts
```

### Advanced Options

```bash
# Multi-version testing
yarn test functional --versions 3

# Debug mode with logging
yarn test functional --debug --no-fail

# Environment-specific
XMTP_ENV=production yarn test agents --debug
XMTP_ENV=dev yarn test functional

# Parallel execution
yarn test functional --parallel
```

### Environment Variables

```bash
export XMTP_ENV=dev          # Development network
export XMTP_ENV=production   # Production network
export XMTP_ENV=local        # Local testing
export LOGGING_LEVEL=debug   # Logging level
```
