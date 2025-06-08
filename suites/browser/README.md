# Browser Testing Suite

This test suite validates the functionality and responsiveness of the XMTP Browser in production environments using Playwright automation.

## What it does

- Tests XMTP Browser UI interactions using Playwright automation
- Validates group creation, member addition, and message sending through the browser interface
- Tests both DM and group messaging scenarios with the GM bot
- Measures browser responsiveness and UI functionality
- Takes screenshots for diagnostic purposes when tests fail

## Setup

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## Key files

- [browser.test.ts](./browser.test.ts) - Browser UI test implementation using Playwright
- [GitHub Actions](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Browser.yml) - Workflow configuration for running the tests

## Test snippet

```typescript
// From browser.test.ts
it("should receive invite with message", async () => {
  try {
    const newGroup = await creator.client.conversations.newGroup(
      getRandomInboxIds(2, 4),
      {
        groupName: "Test Group 1 " + getTime(),
      },
    );
    await sleep(1000);
    await newGroup.addMembers([inbox.inboxId]);
    await newGroup.send(`hi ${receiver}`);
    const result = await xmtpTester.waitForNewConversation(newGroup.name);
    expect(result).toBe(true);
  } catch (e) {
    await xmtpTester.takeSnapshot("gm-group");
    logError(e, expect.getState().currentTestName);
    throw e;
  }
});

it("should respond to a message", async () => {
  try {
    await xmtpTester.newDmFromUI(gmBot.address);
    await xmtpTester.sendMessage(`hi ${receiver}`);
    const result = await xmtpTester.waitForResponse(["gm"]);
    expect(result).toBe(true);
  } catch (e) {
    await xmtpTester.takeSnapshot("gm-group");
    logError(e, expect.getState().currentTestName);
    throw e;
  }
});
```

## Test scenarios

The browser test suite includes the following scenarios:

1. **Group invites with messages** - Creates a group, adds members, sends a message, and validates the invite is received
2. **Group invites without messages** - Creates a group, adds members without sending a message, and validates the invite
3. **DM messaging** - Creates a new DM through the UI and validates bot responses
4. **Group creation and messaging** - Creates a group through the UI and validates messaging functionality
5. **Member addition** - Tests adding new members to existing groups
6. **Multi-user scenarios** - Tests with multiple browser instances

## Test execution

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install

yarn test browser
```

## Configuration

The tests use Playwright with the following configuration:

- Headless mode by default (`headless = true`)
- Default user from inbox configuration
- Automatic screenshot capture on test failures
- GM bot integration for response validation

## Automation

Tests run automatically via GitHub Actions:

```yaml
# From browser.yml
name: browser
on:
  pull_request:
    branches:
      - main
  schedule:
    - cron: "10 * * * *" # Runs at 10 minutes past each hour
  workflow_dispatch:
```

## Artifacts

Test logs, screenshots, and browser automation recordings are stored as artifacts in GitHub Actions for diagnostic purposes.
