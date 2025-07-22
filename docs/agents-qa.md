# Agent validation testing [../suites/agents](../suites/agents)

**Purpose**: Validates health, responsiveness, and behavioral patterns of live XMTP agents deployed across production and development environments.

### Agent interaction tests:

- `agents-dms: validate agent responsiveness in direct message conversations`
- `agents-tagged: verify agents respond appropriately to tagged messages or slash commands`
- `agents-untagged: ensure agents do NOT respond to generic untagged messages`

### Core validations:

- **Response timing**: Measures average response time from message send to agent reply
- **Behavioral filtering**: Validates proper message filtering (respond vs. ignore patterns)
- **Cross-environment health**: Tests agent availability across dev and production networks
- **Command recognition**: Verifies slash command and mention tag recognition

**Measurements**:

- Agent response time in milliseconds
- Success/failure rate per agent
- Behavioral compliance (respond/don't respond as configured)

---

## 1. Direct message testing [../suites/agents/agents-dms.test.ts](../suites/agents/agents-dms.test.ts)

**Purpose**: Validates agent responsiveness in direct message conversations using their configured test messages.

### Test pattern:

- **Per Agent Test**: `agents-dms: {agent.name} DM : {agent.address}`

### Test flow:

1. Create DM conversation with agent using Ethereum address
2. Send agent's configured `sendMessage`
3. Verify agent responds within timeout period
4. Measure response timing and log metrics

### Agent coverage examples:

- **tbachat**: `/help` command testing
- **elsa**: "hi" message testing
- **squabble**: "@squabble.base.eth" tag testing
- **key-check**: "/kc help" command testing
- **tokenbot**: "@tokenbot" tag testing

**Measurements**:

- Response timing (average event timing)
- Success/failure rate
- Agent availability by environment

---

## 2. Tagged message testing [../suites/agents/agents-tagged.test.ts](../suites/agents/agents-tagged.test.ts)

**Purpose**: Validates that agents respond appropriately to tagged messages or slash commands when configured to do so.

### Test pattern:

- **Per Agent Test**: `agents-tagged: {agent.name} should respond to tagged/command message : {agent.address}`

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

**Expected behavior**: All filtered agents should respond to their configured tagged messages.

---

## 3. Untagged message testing [../suites/agents/agents-untagged.test.ts](../suites/agents/agents-untagged.test.ts)

**Purpose**: Validates that agents do NOT respond to generic untagged messages, ensuring proper message filtering.

### Test pattern:

- **Per Agent Test**: `agents-untagged: {agent.name} should not respond to untagged hi : {agent.address}`

### Test flow:

1. Create group conversation with agent and random participant
2. Send initial "hi" message (ignore welcome response)
3. Send second "hi" message
4. Verify agent does NOT respond to untagged message
5. Log metrics for unexpected responses

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

**Measurements**:

- Response time per agent interaction type
- Behavioral compliance percentage
- Environment-specific agent health status
