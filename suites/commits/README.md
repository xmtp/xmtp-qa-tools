# Chaos Test: 100 Epochs

Stress test XMTP group consensus by hammering multiple groups with concurrent operations to verify system stability under chaos conditions.

## Test Flow:

- Create X groups in parallel
- Add X workers as super admins to each group
- Loop each group until epoch 100:
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
- **parallelOperations**: `1` - How many operations to perform in parallel

- **enabledOperations**: - Operations configuration - enable/disable specific operations
  - `updateName`: true, // updates the name of the group
  - `sendMessage`: false, // sends a message to the group
  - `addMember`: true, // adds a random member to the group
  - `removeMember`: true, // removes a random member from the group
  - `createInstallation`: true, // creates a new installation for a random worker
- **workerNames**: Random workers (`random1`, `random2`, ..., `random10`)
- **TARGET_EPOCH**: `100n` - The target epoch to stop the test (epochs are when performing commits to the group)
- **network**: `process.env.XMTP_ENV` - Network environment setting
- **randomInboxIdsCount**: `30` - How many inboxIds to use randomly in the add/remove operations
- **installationCount**: `5` - How many installations to use randomly in the createInstallation operations
- **typeofStreamForTest**: `typeofStream.Message` - Starts a streamAllMessages in each worker
- **typeOfResponseForTest**: `typeOfResponse.Gm` - Replies gm if mentioned
- **typeOfSyncForTest**: `typeOfSync.Both` - Sync all every 5 seconds

## Test setup

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools

# Install dependencies
yarn install

# Start local network
./dev/up

# Run the test 100 times and exports logs
yarn run:commits
```
