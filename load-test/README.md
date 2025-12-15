# XMTP Load Test

Load testing framework for XMTP messaging protocol using Artillery.

## Features

- Configurable load generation using Artillery
- Automatic resource detection and tuning
- Adaptive testing mode that monitors system resources
- Support for dev, production, and D14n environments
- Multiple test modes: sustained load, burst, and adaptive

## Installation

```bash
yarn install
```

## Quick Start

1. Create test identities and groups:

```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev
```

Options:
- `-i, --identities <number>` - Number of test identities to create
- `-g, --groups <number>` - Number of group chats
- `-m, --members <number>` - Members per group
- `-e, --env <env>` - Environment: dev, production, or local
- `-d, --d14n-host <url>` - D14n host URL (defaults to staging)

2. Run a load test:

```bash
npm run test
```

## Test Modes

### Standard Load Test

Runs a sustained load test for extended duration.

```bash
npm run test
```

Configuration: `artillery-config.yml`

### Burst Test

Runs a 1-minute high-intensity burst test.

```bash
npm run test:burst
```

Configuration: `artillery-config-burst.yml`

### Adaptive Test

Automatically ramps up load until system reaches specified memory threshold (default: 200MB free). Monitors system resources in real-time and adjusts worker count accordingly.

```bash
npm run test:adaptive
```

Press Ctrl+C to stop and view final statistics.

### Auto-Tuned Test

Generates optimized configuration based on system resources.

```bash
npm run auto-tune
npm run test:auto
```

Configuration: `artillery-config-auto.yml` (generated)

### Simple Test Runner

Basic TypeScript-based test runner for development.

```bash
npm run test:simple
```

## Architecture

The framework operates in two phases:

**Setup Phase:**
- Creates N XMTP client identities
- Creates M group chats
- Distributes members across groups
- Saves configuration to disk

**Load Test Phase:**
- Spawns worker processes (configurable pool size)
- Each worker loads clients and sends messages
- Messages distributed round-robin across groups
- Metrics collected: throughput, latency, errors

## Configuration

Edit Artillery configuration files to customize test parameters:

- `duration` - Test duration in seconds
- `arrivalRate` - Messages per second
- `pool` - Number of worker processes

Artillery will display real-time metrics during test execution.

## Commands

```
npm run setup         - Create test identities and groups (requires args)
npm run auto-tune     - Generate optimized configuration
npm run test          - Run standard load test
npm run test:burst    - Run 1-minute burst test
npm run test:auto     - Run auto-tuned test
npm run test:adaptive - Run adaptive load test
npm run test:simple   - Run simple test runner
npm run build         - Build Artillery processor
npm run clean         - Remove test data and artifacts
```

## Troubleshooting

**Config not found error:**

Run setup first:
```bash
npx tsx setup.ts -i 50 -g 5 -m 10 -e dev
```

**High error rate:**

Reduce arrival rate or pool size in Artillery configuration.

**Low throughput:**

Increase worker pool size or use more powerful hardware.

**System instability:**

Use adaptive test mode to automatically stay within safe resource limits:
```bash
npm run test:adaptive
```

## EC2 Deployment

Recommended instance types:

| Instance   | vCPUs | RAM  | Est. Throughput |
|-----------|-------|------|----------------|
| t3.large  | 2     | 8GB  | ~30 msg/s     |
| c5.2xlarge| 8     | 16GB | ~100 msg/s    |
| c5.4xlarge| 16    | 32GB | ~200 msg/s    |
| c5.9xlarge| 36    | 72GB | ~400 msg/s    |

For long-running tests, use screen or tmux:

```bash
screen -S loadtest
npm run test
# Detach: Ctrl+A, D
# Reattach: screen -r loadtest
```

## License

MIT

