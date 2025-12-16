# XMTP Load Test

Load testing framework for XMTP messaging protocol using Artillery.

## Features

- Configurable load generation using Artillery
- Mixed workload support: messages, metadata updates, member operations, admin operations
- Automatic resource detection and tuning
- Adaptive testing mode that monitors system resources
- Support for dev, production, and D14n environments
- Multiple test modes: sustained load, burst, and adaptive
- Detailed operation tracking and reporting

## Installation

```bash
# Install dependencies
yarn install

# Build the project (compiles TypeScript to dist/)
yarn build
```

The load-test directory is a standalone project that can be split into its own repository.

## Quick Start

1. Create test identities and groups:

```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev
```

Options:
- `-i, --identities <number>` - Number of test identities to create
- `-g, --groups <number>` - Number of group chats
- `-m, --members <number>` - Members per group
- `-p, --pool <number>` - Additional identities for add/remove operations (default: 50)
- `-w, --workload <preset>` - Workload preset (default: messagesOnly)
- `-e, --env <env>` - Environment: dev, production, or local
- `-d, --d14n-host <url>` - D14n host URL (defaults to staging)

2. Run adaptive load test (recommended):

```bash
npm run test
```

The test will automatically ramp up to maximum safe capacity and show real-time metrics. Press Ctrl+C to stop and view results.

## Test Modes

### Adaptive Load Test (Default)

**This is the default and recommended test mode.**

Automatically ramps up load until system reaches specified memory threshold (default: 200MB free). Monitors system resources in real-time and adjusts worker count accordingly. Works with all workload presets.

```bash
npm run test
```

Features:
- Auto-scaling based on available memory
- Prevents system overload
- Works with all workload mixes
- Real-time metrics display
- Detailed operation breakdown on exit

Press Ctrl+C to stop and view final statistics.

### Fixed-Rate Test

Runs a sustained load test at fixed rate for extended duration. Uses Artillery for fixed throughput testing.

```bash
npm run test:fixed
```

Configuration: `artillery-config.yml`

### Burst Test

Runs a 1-minute high-intensity burst test at maximum configured rate.

```bash
npm run test:burst
```

Configuration: `artillery-config-burst.yml`

### Auto-Tuned Test

Generates optimized Artillery configuration based on system resources, then runs at that fixed rate.

```bash
npm run auto-tune
npm run test:auto
```

Configuration: `artillery-config-auto.yml` (generated)

### Simple Test Runner

Basic TypeScript-based test runner for development and debugging.

```bash
npm run test:simple
```

## Mixed Workload Operations

The load test supports generating mixed workloads across all XMTP operation types, not just message sending.

### Supported Operations

- **sendMessage** - Send text messages to groups
- **updateName** - Update group name
- **updateDescription** - Update group description
- **updateImageUrl** - Update group image URL
- **addMember** - Add members to groups (from pool)
- **removeMember** - Remove members from groups
- **addAdmin** - Promote members to admin
- **removeAdmin** - Demote admins to member
- **addSuperAdmin** - Promote members to super admin
- **removeSuperAdmin** - Demote super admins
- **sync** - Sync group state

### Workload Presets

Specify workload mix during setup using `-w` flag. All presets work with adaptive mode (default test command).

**messagesOnly** (default) - 100% message sending
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev -w messagesOnly
npm run test
```

**balanced** - Balanced mix across all operation types
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -p 100 -e dev -w balanced
npm run test
```

**realistic** - Production-like mix (70% messages, 30% other ops)
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -p 100 -e dev -w realistic
npm run test
```

**metadata** - Heavy metadata operations (name, description, image updates)
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev -w metadata
npm run test
```

**memberChurn** - Heavy member add/remove operations
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -p 200 -e dev -w memberChurn
npm run test
```

**adminOps** - Focus on admin promotion/demotion
```bash
npx tsx setup.ts -i 100 -g 10 -m 20 -e dev -w adminOps
npm run test
```

The adaptive mode automatically scales to your system's capacity for any workload preset.

### Analyzing Results

**Adaptive Mode (default):**
Results are automatically displayed when you press Ctrl+C to stop the test. Report saved to `./data/adaptive-report.json`

Example output:
```
==========================================================
Test Complete!
==========================================================
Duration: 300.5s
Total operations: 15,847
Total errors: 23
Success rate: 99.86%
Average rate: 52.7 ops/s
Peak workers: 12
Final memory: 215MB free (87.2% used)

------------------------------------------------------------
Operations Breakdown:
------------------------------------------------------------
  sendMessage              11,093 (70.00%)
  addMember                 1,268 (8.00%)
  removeMember                792 (5.00%)
  updateName                  792 (5.00%)
  addAdmin                    475 (3.00%)
  ...
```

**Fixed-Rate Mode:**
After running Artillery-based tests, analyze worker results:

```bash
npm run analyze
```

This aggregates results from all Artillery workers. Report saved to `./data/load-test-report.json`

## Architecture

The framework operates in two phases:

**Setup Phase:**
- Creates N XMTP client identities
- Creates M group chats
- Creates P pool identities (for add/remove operations)
- Distributes members across groups
- Saves configuration to disk

**Load Test Phase (Adaptive Mode - Default):**
- Starts with 2 worker processes
- Each worker executes operations based on workload mix
- Automatically ramps up workers based on available memory
- Stops scaling at configured memory threshold (default: 200MB free)
- Operations distributed across all groups and identities
- Real-time metrics: throughput, memory usage, operation breakdown

**Load Test Phase (Fixed-Rate Mode):**
- Uses Artillery to spawn worker processes (configurable pool size)
- Fixed arrival rate and duration
- Operations executed according to workload mix
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
npm run test          - Run adaptive load test (default, recommended)
npm run test:fixed    - Run fixed-rate load test
npm run test:burst    - Run 1-minute burst test
npm run test:auto     - Run auto-tuned test
npm run test:simple   - Run simple test runner
npm run auto-tune     - Generate optimized configuration
npm run analyze       - Analyze Artillery results and generate report
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

The default adaptive mode automatically stays within safe resource limits. If using fixed-rate mode and experiencing instability, reduce arrival rate or pool size in Artillery configuration, or switch to adaptive mode:
```bash
npm run test
```

## EC2 Deployment

Recommended instance types (adaptive mode will auto-scale to capacity):

| Instance   | vCPUs | RAM  | Est. Peak Throughput |
|-----------|-------|------|---------------------|
| t3.large  | 2     | 8GB  | ~30-50 ops/s       |
| c5.2xlarge| 8     | 16GB | ~100-150 ops/s     |
| c5.4xlarge| 16    | 32GB | ~200-300 ops/s     |
| c5.9xlarge| 36    | 72GB | ~400-600 ops/s     |

Note: Actual throughput varies based on workload mix. Operations like message sending are faster than group operations.

For long-running tests, use screen or tmux:

```bash
screen -S loadtest
npm run test
# Detach: Ctrl+A, D
# Reattach: screen -r loadtest
```

The adaptive test will automatically find the optimal load for your instance.

## License

MIT

