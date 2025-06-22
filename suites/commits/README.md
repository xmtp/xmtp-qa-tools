# Chaos Test: Concurrent Group Operations

**Setup:**

- 5 groups, 5 workers, 30 random members
- Target: reach epoch 100 per group (epoch is a measure of how many times the group has been updated)
- 4 concurrent operations per batch

**Test Flow:**

- Create 5 groups in parallel
- Add all workers as super admins to each group

- **Loop until epoch 100:**
  - Run 4 random operations simultaneously:
    - Update group name
    - Add/remove random member (random member is a random inbox id)
    - Send message (random message)
    - Create new installation (random installation) (this is a new installation for the group)
  - Sync group and check epoch progress
  - Log stats every 20 operations

**Purpose:**
Stress test XMTP group consensus by hammering multiple groups with concurrent operations to verify system stability under chaos conditions.

## Download the code

```bash
# Installation For a faster download with just the latest code
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
./dev/up
yarn local-update
yarn run:commits
```

# Current Status

| Runs | Forks | Percentage |
| ---- | ----- | ---------- |
| 50   | 9     | 18%        |
