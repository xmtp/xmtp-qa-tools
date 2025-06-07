# XMTP GM Bot Testing Suite

This test suite validates the functionality and responsiveness of the XMTP GM bot in production environments.

## What it does

- Sends test messages to the XMTP GM bot in both DMs and groups
- Validates that the bot responds with "gm" when sent a message
- Tests the bot using both direct SDK interactions and UI testing with Playwright
- Measures response times and success rates

## Setup

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## Key files

- [gm.test.ts](./gm.test.ts) - Test implementation that sends messages and validates GM bot responses
- [GitHub Actions](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Gm.yml) - Workflow configuration for running the tests

## Test snippet

```typescript
// From gm.test.ts
it("gm-bot: should check if bot is alive", async () => {
  try {
    // Create conversation with the bot
    convo = await workers.get("bob")!.client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: gmBotAddress,
    });

    expect(convo).toBeDefined();
    console.log("convo", convo.id);
    const result = await verifyMessageStream(convo!, workers.getAll(), "hi");
    expect(result.allReceived).toBe(true);
  } catch (e) {
    logError(e, expect.getState().currentTestName);
    throw e;
  }
});
```

## Test execution

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install

yarn test gm
```

## Automation

Tests run automatically via GitHub Actions:

```yaml
# From gm.yml
name: gm
on:
  pull_request:
    branches:
      - main
  schedule:
    - cron: "10 * * * *" # Runs at 10 minutes past each hour
  workflow_dispatch:
```

## Artifacts

Test logs, screenshots, and results are stored as artifacts in GitHub Actions for diagnostic purposes.
