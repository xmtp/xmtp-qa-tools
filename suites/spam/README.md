# Spam Test Suite

Tests spam scenarios by creating groups with predefined spam inbox IDs and measuring the storage impact until reaching a target storage threshold.

- Creates groups with spam inbox IDs to simulate spam scenarios
- Measures storage growth from spam group creation
- Tests with configurable group member sizes and target storage limits
- Analyzes storage impact of spam conversations
- Uses predefined spam inbox IDs to simulate real spam patterns

## How to Run

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
# Run spam tests
yarn test suites/spam

# Run with custom target size
TARGET_SIZE_MB=10 yarn test suites/spam/spam.test.ts
```

### Environment Variables

**Spam Tests:**

- `TARGET_SIZE_MB` - Target storage size in MB for testing (default: 10)
- `GROUP_MEMBER_SIZE` - Array of member counts to test (default: [2])

### Test Configuration

The test uses predefined spam inbox IDs:

```typescript
const spamInboxIds = [
  "c10e8c13c833f1826e98fb0185403c2c4d5737cc432d575468613abf9adae26b",
];
```

### Details

The spam test creates groups containing:

- Random inbox IDs (based on member count - 2)
- Predefined spam inbox IDs
- The bot creator

Groups are created continuously until the database reaches the target storage size, allowing analysis of:

- Storage growth patterns from spam groups
- Number of spam groups created before reaching threshold
- Storage efficiency impact of spam conversations
- Database size progression during spam scenarios
