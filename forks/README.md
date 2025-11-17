# Forks testing

XMTP forks occur when different clients create conflicting states in group conversations.

### Getting started

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools

# Install dependencies
yarn install
```

### Environment setup

```bash
# MAIN
LOGGING_LEVEL=off
LOG_LEVEL=debug
XMTP_ENV=production
```

### Running locally
Before running this suite locally you _must_ run `yarn gen update:local` to pre-populate the database with inboxes to add and remove from the group. Otherwise add/remove member operations will fail, which will not increase the epoch or trigger forks.

### Fork generation through parallel operations

The main approach creates intentional conflicts by running parallel operations on shared groups:

- Create X groups in parallel
- Add X workers as super admins to each group
- Loop each group until epoch Y:
  - Choose random worker and syncAll conversations
  - Run parallel operations:
    - Update group name
    - Send message (random message)
    - Add member (random inboxId)
    - Remove member (random inboxId)
    - Create installation (random inboxId)
  - Sync group
  - Log epoch progress
- Export forks into a folder

### Parameters

Default configuration values (can be overridden via CLI flags):

- **groupCount**: `5` - Number of groups to create in parallel (override with `--group-count`)
- **nodeBindings**: Latest version - Node SDK version to use
- **parallelOperations**: `5` - How many operations to perform in parallel (override with `--parallel-operations`)
- **epochRotationOperations**: Operations that rotate epochs:
  - `updateName`: true - Updates the name of the group
  - `addMember`: true - Adds a random member to the group
  - `removeMember`: true - Removes a random member from the group
- **otherOperations**: Additional operations:
  - `sendMessage`: true - Sends a message to the group
  - `createInstallation`: false - Creates a new installation for a random worker
  - `sync`: false - Syncs the group
- **workerNames**: Random workers (`random1`, `random2`, `random3`, `random4`, `random5`)
- **targetEpoch**: `20` - The target epoch to stop the test (override with `--target-epoch`)
- **network**: `dev` - Network environment setting (override with `--env`)
- **randomInboxIdsCount**: `50` - How many inboxIds to use randomly in the add/remove operations
- **installationCount**: `2` - How many installations to use randomly in the createInstallation operations
- **backgroundStreams**: `false` - Enable message streams on all workers (enable with `--with-background-streams`)

### Test setup in local network

```bash
# Start local network
./dev/up

# Update local network pre-generated inboxIds
yarn local-update

# Process that runs the test 100 times and exports forks logs
yarn fork --count 100 --env local
```

## CLI Usage

The fork detection CLI runs the test multiple times and collects statistics:

```bash
# Run 100 times (default)
yarn fork

# Run a specific number of times
yarn fork --count 50

# Clean all raw logs before starting
yarn fork --clean-all

# Keep logs that don't contain fork content
yarn fork --no-remove-non-matching

# Run on a specific environment
yarn fork --count 200 --env local

# Enable message streams on all workers
yarn fork --with-background-streams

# Configure test parameters
yarn fork --group-count 10 --parallel-operations 3 --target-epoch 50

# Set log level for test runner
yarn fork --log-level debug

# Show help
yarn fork --help
```

### CLI Options

- `--count`: Number of times to run the fork detection process (default: 100)
- `--clean-all`: Clean all raw logs before starting (default: false)
- `--remove-non-matching`: Remove logs that don't contain fork content (default: true)
- `--no-remove-non-matching`: Keep logs that don't contain fork content
- `--env`: XMTP environment - `local`, `dev`, or `production` (default: `dev` or `XMTP_ENV`)
- `--network-chaos-level`: Network chaos level - `none`, `low`, `medium`, or `high` (default: `none`)
- `--db-chaos-level`: Database chaos level - `none`, `low`, `medium`, or `high` (default: `none`)
- `--with-background-streams`: Enable message streams on all workers (default: false)
- `--log-level`: Log level for test runner - `debug`, `info`, `warn`, `error` (default: `warn`)
- `--group-count`: Number of groups to run the test against (default: 5)
- `--parallel-operations`: Number of parallel operations run on each group (default: 5)
- `--target-epoch`: Target epoch to stop the test at (default: 20)

### Statistics Output

The CLI provides statistics including:

- Total runs and forks detected
- Runs with forks vs. runs without forks
- Runs with errors
- Fork detection rate
- Average forks per run
- Average forks per run (with forks only)

### Network Chaos Testing

The fork test can inject network chaos (latency, jitter, packet loss) to simulate adverse network conditions. This helps identify forks that occur under realistic network stress.

**Requirements:**
- Network chaos requires `--env local`
- Multinode Docker containers must be running (`./multinode/up`)
- Must be run on Linux with `tc` and `iptables` commands available. Will not work on MacOS.
- Requires `sudo` access

**Chaos Levels:**

| Level  | Delay Range | Jitter Range | Packet Loss | Interval |
|--------|-------------|--------------|-------------|----------|
| low    | 50-150ms    | 0-50ms       | 0-2%        | 15s      |
| medium | 100-300ms   | 0-75ms       | 0-3.5%      | 10s      |
| high   | 0-500ms     | 50-200ms     | 0-25%       | 10s      |

**Usage:**

```bash
# Run with low network chaos
yarn fork --env local --network-chaos-level low

# Run with high network chaos level
yarn fork --env local --network-chaos-level high

# Run 50 iterations with medium network chaos
yarn fork --count 50 --env local --network-chaos-level medium
```

**How it works:**
1. Initializes Docker container handles for all multinode nodes
2. Applies random network conditions (within preset ranges) at regular intervals
3. Runs the fork test as normal while chaos is active
4. Cleans up network rules when test completes (even if test fails)

**Example output:**
```
NETWORK CHAOS PARAMETERS
  delay: 0-500ms
  jitter: 50-200ms
  packetLoss: 0-25%
  interval: 10000ms
```

### Database Chaos Testing

The fork test can inject database chaos by temporarily locking database files to simulate database contention and I/O issues.

**Chaos Levels:**

| Level  | Lock Duration | Interval |
|--------|---------------|----------|
| low    | 50-250ms      | 10s      |
| medium | 100-2000ms    | 15s      |
| high   | 500-2000ms    | 5s       |

**Usage:**

```bash
# Run with low database chaos
yarn fork --db-chaos-level low

# Run with high database chaos level
yarn fork --db-chaos-level high

# Run 50 iterations with medium database chaos
yarn fork --count 50 --db-chaos-level medium

# Combine network and database chaos
yarn fork --env local --network-chaos-level medium --db-chaos-level medium
```

**How it works:**
1. Periodically locks database files for each worker
2. Lock duration is randomized within the preset range
3. Workers experience database busy/locked errors during operations
4. Cleans up and waits for all locks to complete when test finishes

**Example output:**
```
DATABASE CHAOS PARAMETERS
  lockDuration: 500-2000ms
  interval: 5000ms
```
