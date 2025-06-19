# Slack Integration Tests

This directory contains comprehensive tests for verifying Slack channel history fetching functionality.

## Overview

The Slack bot integration has been challenging to debug, so these tests provide:

1. **Unit Tests with Mocks** - Test the core logic without API dependencies
2. **Integration Verification** - Test real API calls when credentials are available
3. **Isolated Testing** - Verify specific functions work correctly

## Files

- `slack-history.test.ts` - Comprehensive unit tests with mocked Slack API
- `verify-bot.ts` - Real API integration verification script
- `run-tests.ts` - Test runner script
- `README.md` - This documentation

## Running Tests

### Unit Tests (Recommended)

```bash
# Run all Slack integration tests
npm test tests/slack-integration/

# Or run specific test file
npx vitest run tests/slack-integration/slack-history.test.ts

# Or use the test runner
npx tsx tests/slack-integration/run-tests.ts
```

### Integration Verification (Requires Slack Credentials)

```bash
# Test real Slack API integration
npx tsx tests/slack-integration/verify-bot.ts
```

## Test Coverage

### Unit Tests Include:

✅ **Channel Finding**

- Find channel by exact name
- Handle channel names with # prefix
- Return null for non-existent channels
- Handle Slack API errors properly

✅ **History Fetching**

- Fetch channel history successfully
- Filter messages by search query
- Respect API limits (cap at 100)
- Handle API errors gracefully

✅ **Message Formatting**

- Format messages for display
- Handle empty message lists
- Truncate long messages (>200 chars)
- Limit displayed message count

✅ **Full Integration Workflow**

- Complete end-to-end process
- Handle the specific test failure message format
- Parse XMTP MLS error logs correctly

### Mock Data Includes:

The tests use realistic mock data including:

- Sample `notify-qa-tools` channel
- Real test failure message from your Slack:
  ```
  Test Failure :x:
  Test: Browser
  Environment: dev
  ...
  xmtp_mls::groups::key_package_cleaner_worker: sync worker error
  ```

## Test Results

When you run the tests, you should see:

```
✅ Full integration test passed!
📋 Formatted output preview:
📋 Found 2 message(s):

🕒 6/16/2025, 7:50:23 PM
👤 <@U123456789>
💬 Test Failure :x:
Test: Browser
Environment: dev
...
```

## Debugging the Real Bot

If the unit tests pass but the real bot still doesn't work:

1. **Check Permissions**: Bot needs to be invited to `#notify-qa-tools`
2. **Verify Credentials**: `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` must be valid
3. **Check Logs**: The enhanced logging should show exactly where it fails
4. **Run Verification**: Use `verify-bot.ts` to test real API access

## Expected Bot Behavior

When working correctly, asking the bot "show me history" should:

1. Detect "history" intent or keyword
2. Find the `notify-qa-tools` channel
3. Fetch recent messages
4. Format and display them in Slack

The enhanced bot now has multiple fallback mechanisms to catch history requests.

## Troubleshooting

If tests fail:

1. **Mock Tests Failing**: Check test logic or mock data
2. **Real API Tests Failing**: Check Slack credentials and permissions
3. **Bot Still Not Working**: Compare working test functions with bot implementation

The unit tests prove the core logic works - any remaining issues are likely authentication/permissions related.
