# XMTP Agent Health Testing Suite

This test suite validates the health and responsiveness of live XMTP agents in production environments.

## What it does

- Sends test messages to production XMTP agents
- Validates agent responses against expected patterns
- Measures response times and success rates
- Reports health status for monitoring

## Setup

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-tools
cd xmtp-qa-tools
yarn install
```

## Key files

- [production.json](./production.json) - List of agents to be tested with their addresses
- [agents.test.ts](./agents.test.ts) - Test implementation that sends messages and validates responses
- [GitHub Actions](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml) - Workflow configuration for running the tests

## Test snippet

```typescript
// From agents.test.ts
for (const agent of typedAgents) {
  it(`test ${agent.name}:${agent.address} on production`, async () => {
    try {
      const convo = await workers
        .get("bot")
        ?.client.conversations.newDmWithIdentifier({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        });
      expect(convo).toBeDefined();
      const result = await verifyDmStream(
        convo!,
        workers.getAll(),
        agent.sendMessage,
      );
      expect(result.allReceived).toBe(true);
    } catch (error) {
      logError(error, `${agent.name}-${agent.address}`);
      throw error;
    }
  });
}
```

## Test execution

```bash
yarn test agents
```

## Automation

Tests run automatically via [GitHub Actions](https://github.com/xmtp/xmtp-qa-tools/actions/workflows/Agents.yml):

```yaml
# From agents.yml
name: agents
on:
  pull_request:
    branches:
      - main
  schedule:
    - cron: "10 * * * *" # Runs at 10 minutes past each hour
  workflow_dispatch:
```

## Artifacts

Test logs and results are stored as artifacts in GitHub Actions for diagnostic purposes.
