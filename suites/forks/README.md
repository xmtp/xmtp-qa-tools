# Forks

XMTP forks occur when different clients create conflicting states in group conversations.

## Fork generation through stress testing

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

## Parameters

- **groupCount**: `5` - Number of groups to create in parallel
- **nodeVersion**: `3.1.1` - Node SDK version to use
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

## Test setup

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools

# Install dependencies
yarn install

# Start local network
./dev/up

# Update local network pre-generated inboxIds
yarn local-update

# Process that runs the test 100 times and exports forks logs
yarn run:forks
```

## Log capture automation

### The run.sh tool

The `suites/forks/run.sh` script provides automated testing with clean log processing:

```bash
#!/bin/bash
# Handle Ctrl+C to exit cleanly
trap 'echo -e "\n\nScript interrupted by user. Exiting..."; exit 0' INT

# Default to 100 runs if no parameter provided
num_runs=${1:-100}

# Clean start
rm -rf logs/
rm -rf .data/

# Run test iterations
for ((i=1; i<=num_runs; i++)); do
    echo "Running test iteration $i of $num_runs"
    yarn test suites/forks/forks.test.ts --no-fail --debug
    exit_code=$?
    echo "Test iteration $i completed with exit code $exit_code"
done

# Process and clean logs
yarn ansi:forks

# Count detected forks
fork_count=$(find logs/cleaned -type f 2>/dev/null | wc -l)
echo "Found $fork_count forks in logs/cleaned"
```

### Log processing features

- **Clean slate**: Removes old logs and data before starting
- **Continuous capture**: Each iteration captures debug logs
- **ANSI cleaning**: Strips escape codes for analysis
- **Fork counting**: Automatically counts detected conflicts
- **Graceful interruption**: Ctrl+C exits cleanly
