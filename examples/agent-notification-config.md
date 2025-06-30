# Agent Notification Configuration Examples

This document provides examples of how to configure and use the new agent notification system.

## Basic Agent Configuration

Each agent in `inboxes/agents.json` can now specify a Slack channel for notifications:

```json
{
  "name": "my-agent",
  "baseName": "my-agent.base.eth", 
  "address": "0x123456789abcdef...",
  "sendMessage": "hi",
  "networks": ["dev", "production"],
  "slackChannel": "#my-agent-alerts"
}
```

## Test Implementation Example

```typescript
import { sendAgentNotification } from "@helpers/notification-service";
import { type AgentConfig } from "../types/agents";

// In your agent test
for (const agent of filteredAgents as AgentConfig[]) {
  it(`${env}: ${agent.name} : ${agent.address}`, async () => {
    const errorLogs = new Set<string>();
    
    try {
      // Test the agent...
      const result = await testAgent(agent);
      
      if (!result.success) {
        errorLogs.add(`Agent ${agent.name} failed to respond`);
        errorLogs.add(`Response time: ${result.responseTime}ms`);
        
        // Send notification to agent-specific channel
        await sendAgentNotification({
          agentName: agent.name,
          agentAddress: agent.address,
          errorLogs,
          testName: `agents-${agent.name}`,
          env,
          slackChannel: agent.slackChannel, // Uses agent's specific channel
          responseTime: result.responseTime,
        });
      }
      
      expect(result.success).toBe(true);
    } catch (error) {
      // Handle errors and send notifications...
    }
  });
}
```

## Notification Service Usage

### Agent-Specific Notifications

```typescript
import { sendAgentNotification } from "@helpers/notification-service";

await sendAgentNotification({
  agentName: "my-agent",
  agentAddress: "0x123...",
  errorLogs: new Set(["Error 1", "Error 2"]),
  testName: "agent-test",
  env: "production",
  slackChannel: "#my-agent-alerts",
  responseTime: 5000,
});
```

### Generic Notifications

```typescript
import { NotificationService, NotificationProvider, NotificationType } from "@helpers/notification-service";

const service = NotificationService.getInstance();

await service.sendNotification({
  provider: NotificationProvider.SLACK,
  title: "Test Alert",
  message: "Something happened",
  type: NotificationType.WARNING,
  channel: "#general",
  timestamp: new Date(),
});
```

### Multiple Provider Support (Future)

```typescript
// Slack notification
await service.sendNotification({
  provider: NotificationProvider.SLACK,
  title: "Slack Alert",
  message: "Message for Slack",
  type: NotificationType.ERROR,
  channel: "#alerts",
});

// Discord notification (when implemented)
await service.sendNotification({
  provider: NotificationProvider.DISCORD,
  title: "Discord Alert", 
  message: "Message for Discord",
  type: NotificationType.ERROR,
  webhookUrl: "https://discord.com/api/webhooks/...",
});

// Email notification (when implemented)
await service.sendNotification({
  provider: NotificationProvider.EMAIL,
  title: "Email Alert",
  message: "Message for email",
  type: NotificationType.ERROR,
  to: ["admin@example.com"],
  subject: "Test Failure Alert",
});
```

## Environment Variables

```bash
# Required for Slack notifications
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token

# Default Slack channel (if not specified per agent)
SLACK_CHANNEL=#general

# XMTP environment
XMTP_ENV=dev

# Geographic location for test metadata
GEOLOCATION=us-east
```

## Message Format

Agent notifications include rich formatting with:

- Agent name and address
- Test environment and region
- Response time metrics
- Links to dashboards and logs
- Error logs and context
- Timestamp and geographic information

Example notification:

```
*Agent Test Failure ❌*
*Agent:* `my-agent`
*Address:* `0x123456789abcdef...`
*Test:* agents-my-agent
*Environment:* `production`
*Geolocation:* `us-east`
*Response Time:* `5000ms`
*Timestamp:* `12/19/2024, 3:30:45 PM`
*General dashboard:* View
*Full logs:* View
*Test log:* View url
*Agent tested:* my-agent

Logs:
```
Agent my-agent failed to respond after 3 retries
Response time exceeded timeout: 30000ms
```

## Benefits

1. **Targeted Notifications**: Each agent team gets notifications only for their agent
2. **Reduced Noise**: No more flooding a single channel with all agent failures
3. **Better Organization**: Agent-specific channels help with debugging and accountability
4. **Extensible**: Easy to add new notification providers (Discord, Email, etc.)
5. **Type Safety**: Full TypeScript support prevents configuration errors
6. **Backward Compatible**: Existing notification system continues to work