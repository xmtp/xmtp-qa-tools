import productionAgents from "@agents/agents";
import {
  AGENT_RESPONSE_TIMEOUT,
  PING_MESSAGE,
  waitForResponse,
  type AgentConfig,
} from "@agents/helper";
import { Agent, type XmtpEnv } from "@agents/versions";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { describe, expect, it } from "vitest";

const testName = "agents-untagged";

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter((agent) =>
    agent.networks.includes(env),
  );

  const createMetricTags = (agentConfig: AgentConfig): ResponseMetricTags => ({
    test: testName,
    metric_type: "agent",
    metric_subtype: "group",
    live: agentConfig.live ? "true" : "false",
    agent: agentConfig.name,
    address: agentConfig.address,
    sdk: "",
  });

  it("should have agents configured for this environment", () => {
    expect(filteredAgents.length).toBeGreaterThan(0);
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} should not respond to untagged hi : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({});

      try {
        const testUserAddress = getInboxes(1)[0].accountAddress;
        const conversation = await agent.createGroupWithAddresses([
          agentConfig.address,
          testUserAddress,
        ] as `0x${string}`[]);

        console.log(
          `📤 Sending "hi" to ${agentConfig.name} (${agentConfig.address}) in group`,
        );

        // Ignore welcome message
        try {
          await waitForResponse({
            client: agent.client as any,
            conversation: {
              send: (content: string) => conversation.sendText(content),
            },
            conversationId: conversation.id,
            senderInboxId: agent.client.inboxId,
            timeout: AGENT_RESPONSE_TIMEOUT,
            messageText: PING_MESSAGE,
          });
        } catch {
          // Welcome message timeout is acceptable
          console.log("No welcome message received (this is okay)");
        }

        // Test actual response to untagged message (plain "hi", no @mention)
        let result;
        try {
          result = await waitForResponse({
            client: agent.client as any,
            conversation: {
              send: (content: string) => conversation.sendText(content),
            },
            conversationId: conversation.id,
            senderInboxId: agent.client.inboxId,
            timeout: AGENT_RESPONSE_TIMEOUT,
            messageText: "hi",
          });
        } catch {
          // No response is expected for untagged messages
          result = {
            success: false,
            sendTime: 0,
            responseTime: AGENT_RESPONSE_TIMEOUT,
            responseMessage: null,
          };
        }

        const responseTime = Math.max(result.responseTime || 0, 0.0001);
        sendMetric("response", responseTime, createMetricTags(agentConfig));

        if (result.success && result.responseMessage) {
          console.log(
            `WARNING: ${agentConfig.name} responded to untagged message in ${responseTime.toFixed(2)}ms`,
          );
        } else {
          console.log(
            `${agentConfig.name} correctly did not respond to untagged message`,
          );
        }

        // The agent should NOT have responded to an untagged message
        expect(result.success).toBe(false);
      } finally {
        await agent.stop();
      }
    });
  }
});
