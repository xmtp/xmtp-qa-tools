# XMTP Agent Health Testing Suite (TS_Agents)

This test suite validates the health and responsiveness of live XMTP agents in production environments.

## What it does

- Sends test messages to production XMTP agents
- Validates agent responses against expected patterns
- Measures response times and success rates
- Reports health status for monitoring

## Setup

```bash
git clone --depth=1 https://github.com/xmtp/xmtp-qa-testing
cd xmtp-qa-testing
yarn install
```

## Key files

- [production.json](./production.json) - List of agents to be tested with their addresses
- [TS_Agents.test.ts](./TS_Agents.test.ts) - Test implementation that sends messages and validates responses
- [GitHub Actions](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/Agents.yml) - Workflow configuration for running the tests

## Test snippet

```typescript
// From TS_Agents.test.ts
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
        workers.getWorkers(),
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
yarn test TS_Agents
```

## Automation

Tests run automatically via [GitHub Actions](https://github.com/xmtp/xmtp-qa-testing/actions/workflows/Agents.yml):

```yaml
# From TS_Agents.yml
name: TS_Agents
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
