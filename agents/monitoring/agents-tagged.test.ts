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

const testName = "agents-tagged";

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
    it(`${testName}: ${agentConfig.name} should respond to tagged/command message : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({});

      try {
        // Tag format: @name convention (e.g., "@agentName ping from QA")
        const testMessage = `@${agentConfig.name} ${PING_MESSAGE}`;
        const testUserAddress = getInboxes(1)[0].accountAddress;
        const conversation = await agent.createGroupWithAddresses([
          agentConfig.address,
          testUserAddress,
        ] as `0x${string}`[]);

        console.log(
          `📤 Sending "${testMessage}" to ${agentConfig.name} (${agentConfig.address}) in group`,
        );

        // Skip the first welcome message by checking sender identity
        // instead of using fragile time-based filtering (clock skew can cause issues).
        let firstMessageSkipped = false;

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
            messageText: testMessage,
            messageFilter: (message) => {
              // Skip messages from the test agent itself (should not happen
              // since waitForResponse already filters these, but guard anyway)
              if (
                message.senderInboxId.toLowerCase() ===
                agent.client.inboxId.toLowerCase()
              ) {
                return false;
              }

              // Skip the first message from the bot, which is the welcome message
              // sent automatically when the agent is added to the group
              if (!firstMessageSkipped) {
                console.log(
                  `Skipping welcome message from ${agentConfig.name}`,
                );
                firstMessageSkipped = true;
                return false;
              }

              return true;
            },
          });
        } catch (error) {
          console.error(
            `waitForResponse failed for ${agentConfig.name}:`,
            error,
          );
          throw error;
        }

        const responseTime = Math.max(result.responseTime || 0, 0.0001);
        sendMetric("response", responseTime, createMetricTags(agentConfig));

        expect(result.success).toBe(true);
        expect(result.responseMessage).toBeTruthy();

        console.log(
          `${agentConfig.name} responded in ${responseTime.toFixed(2)}ms`,
        );
      } finally {
        await agent.stop();
      }
    });
  }
});
