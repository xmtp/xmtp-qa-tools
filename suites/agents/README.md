# XMTP agent testing suite report

## Overview

The Agent Testing Suite validates the health, responsiveness, and behavioral patterns of live XMTP agents deployed across production and development environments. These tests ensure agents respond appropriately to different message types and interaction patterns.

---

## Test suite architecture

The agent testing is organized into 3 primary test categories that validate different interaction patterns and response behaviors.

---

## 1. Direct message testing (`agents-dms.test.ts`)

**Purpose**: Validates agent responsiveness in direct message conversations using their configured test messages.

### Test pattern:

- **Per Agent Test**: `${testName}: ${agent.name} DM : ${agent.address}`

### Test flow:

1. Create DM conversation with agent using Ethereum address
2. Send agent's configured `sendMessage`
3. Verify agent responds within timeout period
4. Measure response timing and log metrics

### Agent coverage:

- **tbachat** - `/help` command testing
- **elsa** - Basic "hi" message testing
- **csx** - "hola" message testing
- **gang** - "hola" message testing
- **flaunchy** - "hi" message testing
- **mamo** - "hi" message testing
- **squabble** - "@squabble.base.eth" tag testing
- **arma** - "hi" message testing
- **onit** - "hi" message testing
- **byte** - "hi" message testing
- **gm** - "hola" message testing
- **local** - "hola" message testing
- **bankr** - "hey there how are you?" extended message testing
- **key-check** - "/kc help" command testing
- **bitte** - "hi" message testing
- **tokenbot** - "@tokenbot" tag testing

**Metrics collected**:

- Response timing (average event timing)
- Success/failure rate
- Agent availability by environment

---

## 2. Tagged message testing (`agents-tagged.test.ts`)

**Purpose**: Validates that agents respond appropriately to tagged messages or slash commands when they are configured to do so.

### Test pattern:

- **Per Agent Test**: `${testName}: ${agent.name} should respond to tagged/command message : ${agent.address}`

### Test flow:

1. Create group conversation with agent and random participant
2. Send tagged message or slash command:
   - Slash commands: sent as-is (e.g., `/help`)
   - Regular messages: prefixed with agent tag (e.g., `@agent.base.eth message`)
3. Verify agent responds within timeout
4. Measure response metrics

### Agent filtering:

- Only tests agents where `respondOnTagged: true`
- Filters by network environment (`dev` or `production`)

### Tagged response validation:

- **Command-based agents**: `/help`, `/kc help` - testing slash command recognition
- **Tag-based agents**: `@agent.base.eth message` - testing mention recognition
- **Hybrid agents**: Some agents respond to both patterns

**Expected behavior**: All filtered agents should respond to their configured tagged messages.

---

## 3. Untagged message testing (`agents-untagged.test.ts`)

**Purpose**: Validates that agents do NOT respond to generic untagged messages, ensuring proper message filtering.

### Test pattern:

- **Per Agent Test**: `${testName}: ${agent.name} should not respond to untagged hi : ${agent.address}`

### Test flow:

1. Create group conversation with agent and random participant
2. Send initial "hi" message (ignore welcome response)
3. Send second "hi" message
4. Verify agent does NOT respond to untagged message
5. Log metrics for unexpected responses

### Agent filtering:

- Only tests agents where `respondOnTagged: true`
- Filters by network environment

### Negative testing:

- **Expected behavior**: Agents should NOT respond to generic "hi" messages
- **Failure condition**: If agent responds, test fails and logs warning
- **Purpose**: Prevents spam responses and validates message filtering logic

---

## Agent configuration

### Agent properties:

- **name**: Agent identifier
- **baseName**: ENS or display name
- **address**: Ethereum address
- **sendMessage**: Test message to send
- **networks**: Supported networks (`["dev", "production"]`)
- **respondOnTagged**: Whether agent responds to tagged messages
- **live**: Production status flag
- **slackChannel**: Alert channel for monitoring

### Environment handling:

- Tests automatically filter agents by `XMTP_ENV` environment variable
- Skips testing if no agents are configured for current environment
- Supports both development and production agent validation

---

## Metrics and monitoring

### Response metrics:

- **Response time**: Average timing from message send to agent response
- **Success rate**: Percentage of successful agent responses
- **Timeout handling**: Uses `streamTimeout` value for non-responsive agents

### Datadog integration:

```typescript
sendMetric("response", metricValue, {
  test: testName,
  metric_type: "agent",
  metric_subtype: "dm", // or "group"
  live: agent.live,
  agent: agent.name,
  address: agent.address,
  sdk: workers.getCreator().sdk,
} as ResponseMetricTags);
```

### Failure detection:

- Logs warnings for failed responses: `console.warn(agent.name, "FAILED")`
- Tracks both expected failures (untagged tests) and unexpected failures (DM/tagged tests)
- Timeout values logged instead of zero for non-responsive agents

---

## Test execution

### Environment setup:

```bash
# Test all agent suites
yarn test agents

# Test specific agent interaction type
yarn test agents-dms
yarn test agents-tagged
yarn test agents-untagged
```

### Network configuration:

- Set `XMTP_ENV=production` for production agent testing
- Set `XMTP_ENV=dev` for development agent testing
- Tests automatically skip if no agents configured for environment

### Key validations:

- Agent discovery and connection establishment
- Message delivery and response verification
- Behavioral pattern validation (respond/don't respond)
- Cross-environment agent health monitoring
- Performance benchmarking for agent response times
