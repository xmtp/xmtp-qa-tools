# Spam Testing Suite

This test suite validates XMTP protocol behavior under spam scenarios, measuring storage impact and system performance when handling malicious group creation patterns.

## What it does

- Creates groups with predefined spam inbox IDs to simulate spam attacks
- Measures storage growth impact from spam group creation
- Tests storage behavior with configurable group member sizes
- Analyzes storage threshold limits and cleanup behavior
- Validates protocol resilience against spam patterns

## Environment Setup

Set `XMTP_ENV` to `dev` or `production` to test spam resilience on the corresponding network.

### Configuration Variables

- `TARGET_SIZE_MB` - Target storage size in MB for testing (default: 10)
- `GROUP_MEMBER_SIZE` - Array of member counts to test (default: [2])

## How to run

### Run spam testing suite

```bash
yarn test spam
```

### Run with custom parameters

```bash
# Test with larger storage target
TARGET_SIZE_MB=50 yarn test spam

# Test with multiple group sizes
GROUP_MEMBER_SIZE=[2,5,10] yarn test spam
```

## Test Scenarios

### Storage Impact Analysis

- **Baseline Storage**: Measures initial storage footprint
- **Spam Group Creation**: Creates groups with known spam inbox IDs
- **Storage Growth Tracking**: Monitors storage increase per spam group
- **Threshold Testing**: Tests behavior when reaching storage limits

### Spam Pattern Simulation

The test uses predefined spam inbox IDs to simulate real-world spam patterns:

```typescript
const spamInboxIds = [
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b",
  // Additional spam IDs for comprehensive testing
];
```

## Metrics Collected

- **Storage growth per spam group**
- **Time to create spam groups**
- **Storage threshold behavior**
- **Protocol resilience metrics**
- **Cleanup and recovery performance**

## Security Considerations

This test suite helps validate:

- Storage explosion attack resilience
- Group creation rate limiting effectiveness
- Spam detection and mitigation capabilities
- Resource consumption under attack scenarios

## Key Files

- **[spam.test.ts](./spam.test.ts)** - Main spam testing implementation
- **[README.md](./README.md)** - This documentation
