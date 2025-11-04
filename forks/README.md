# Forks testing

XMTP forks occur when different clients create conflicting states in group conversations.

## Fork generation through send testing

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

### Log processing features

- **Clean slate**: Removes old logs and data before starting
- **Continuous capture**: Each iteration captures debug logs
- **ANSI cleaning**: Strips escape codes for analysis
- **Fork counting**: Automatically counts detected conflicts
- **Graceful interruption**: Ctrl+C exits cleanly
