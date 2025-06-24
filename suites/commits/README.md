# Chaos Test: 100 Epochs

Stress test XMTP group consensus by hammering multiple groups with concurrent operations to verify system stability under chaos conditions.

**Test Flow:**

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
- Clean logs and export forks

## Test setup

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools

# Install dependencies
yarn install

# Start local network
./dev/up

# Run the test 100 times
yarn run:commits
```
