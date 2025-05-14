# XMTP GM Bot Testing Suite (TS_Gm)

This test suite validates the functionality and responsiveness of the XMTP GM bot in production environments.

## What it does

- Sends test messages to the XMTP GM bot in both DMs and groups
- Validates that the bot responds with "gm" when sent a message
- Tests the bot using both direct SDK interactions and UI testing with Playwright
- Measures response times and success rates

## Setup

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Key files

- [TS_Gm.test.ts](./TS_Gm.test.ts) - Test implementation that sends messages and validates GM bot responses
- [GitHub Actions](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/TS_Gm.yml) - Workflow configuration for running the tests

## Test snippet

```typescript
// From TS_Gm.test.ts
it("gm-bot: should check if bot is alive", async () => {
  try {
    // Create conversation with the bot
    convo = await workers.get("bob")!.client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: gmBotAddress,
    });

    expect(convo).toBeDefined();
    console.log("convo", convo.id);
    const result = await verifyDmStream(convo!, workers.getWorkers(), "hi");
    expect(result.allReceived).toBe(true);
  } catch (e) {
    logError(e, expect.getState().currentTestName);
    throw e;
  }
});
```

## Test execution

```bash
yarn test TS_Gm
```

## Automation

Tests run automatically via GitHub Actions:

```yaml
# From TS_Gm.yml
name: TS_Gm
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
