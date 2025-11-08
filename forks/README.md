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

### Fork generation through send testing

The main approach creates intentional conflicts by running parallel operations on shared groups:

- Create X groups in parallel
- Add X workers as super admins to each group
- Loop each group until epoch Y:
  - Choose random worker and syncAll conversations
  - Run between 2 random operations:
    - Update group name
    - Send message (random message)
    - Add member (random inboxId)
    - Remove member (random inboxId)
    - Create installation (random inboxId)
  - Sync group
  - Log epoch progress
- Export forks into a folder

### Parameters

- **groupCount**: `5` - Number of groups to create in parallel
- **nodeBindings**: `3.x.x` - Node SDK version to use
- **parallelOperations**: `1` - How many operations to perform in parallel
- **enabledOperations**: - Operations configuration - enable/disable specific operations
  - `updateName`: true, // updates the name of the group
  - `sendMessage`: false, // sends a message to the group
  - `addMember`: true, // adds a random member to the group
  - `removeMember`: true, // removes a random member from the group
  - `createInstallation`: true, // creates a new installation for a random worker
- **workerNames**: Random workers (`random1`, `random2`, ..., `random10`)
- **targetEpoch**: `100n` - The target epoch to stop the test (epochs are when performing forks to the group)
- **network**: `process.env.XMTP_ENV` - Network environment setting
- **randomInboxIdsCount**: `30` - How many inboxIds to use randomly in the add/remove operations
- **installationCount**: `5` - How many installations to use randomly in the createInstallation operations
- **typeofStreamForTest**: `typeofStream.None` - No streams started by default (configured on-demand)
- **typeOfSyncForTest**: `typeOfSync.None` - No automatic syncing (configured on-demand)

### Test setup in local network

```bash
# Start local network
./dev/up

# Update local network pre-generated inboxIds
yarn local-update

# Process that runs the test 100 times and exports forks logs
yarn test forks --attempts 100 --env local --log warn --file --forks
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

# Run on a specific environment
yarn fork --count 200 --env local

# Show help
yarn fork --help
```

The CLI provides statistics including:

- Total runs and forks detected
- Fork detection rate
- Average forks per run

### Network Chaos Testing

The fork test can inject network chaos (latency, jitter, packet loss) to simulate adverse network conditions. This helps identify forks that occur under realistic network stress.

**Requirements:**
- Network chaos requires `--env local`
- Multinode Docker containers must be running (`./dev/up`)
- Requires `sudo` access for `tc` and `iptables` commands

**Chaos Levels:**

| Level  | Delay Range | Jitter Range | Packet Loss | Interval |
|--------|-------------|--------------|-------------|----------|
| low    | 50-150ms    | 0-50ms       | 0-2%        | 15s      |
| medium | 100-300ms   | 0-75ms       | 0-3.5%      | 10s      |
| high   | 100-500ms   | 0-100ms      | 0-5%        | 10s      |

**Usage:**

```bash
# Run with default (medium) chaos
yarn fork --env local --chaos-enabled

# Run with high chaos level
yarn fork --env local --chaos-enabled --chaos-level high

# Run 50 iterations with low chaos
yarn fork --count 50 --env local --chaos-enabled --chaos-level low
```

**How it works:**
1. Initializes Docker container handles for all multinode nodes
2. Applies random network conditions (within preset ranges) at regular intervals
3. Runs the fork test as normal while chaos is active
4. Cleans up network rules when test completes (even if test fails)

**Example output:**
```
NETWORK CHAOS PARAMETERS
chaosEnabled: true
chaosLevel: high
  delay: 100-500ms
  jitter: 0-100ms
  packetLoss: 0-5%
  interval: 10000ms
```

### Log processing features

- **Clean slate**: Removes old logs and data before starting
- **Continuous capture**: Each iteration captures debug logs
- **ANSI cleaning**: Strips escape codes for analysis
- **Fork counting**: Automatically counts detected conflicts
- **Graceful interruption**: Ctrl+C exits cleanly
