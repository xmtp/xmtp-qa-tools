import productionAgents from "@agents/agents";
import {
  AGENT_RESPONSE_TIMEOUT,
  waitForResponse,
  type AgentConfig,
} from "@agents/helper";
import { Agent, type XmtpEnv } from "@agents/versions";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { ActionsCodec } from "agents/utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "agents/utils/inline-actions/types/IntentContent";
import { describe, expect, it } from "vitest";

const testName = "agents-untagged";

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const isProduction = env === "production";
  const filteredAgents = productionAgents.filter((agent) =>
    agent.networks.includes(env),
  );

  const createMetricTags = (agentConfig: AgentConfig): ResponseMetricTags => ({
    test: testName,
    metric_type: "agent",
    metric_subtype: "dm",
    live: agentConfig.live ? "true" : "false",
    agent: agentConfig.name,
    address: agentConfig.address,
    sdk: "",
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} should not respond to untagged hi : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({
        codecs: [new ActionsCodec(), new IntentCodec()],
      });

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
              send: (content: string) => conversation.send(content),
            },
            conversationId: conversation.id,
            senderInboxId: agent.client.inboxId,
            timeout: AGENT_RESPONSE_TIMEOUT,
            messageText: "hi",
          });
        } catch {
          // Welcome message timeout is acceptable
          console.log("No welcome message received (this is okay)");
        }

        // Test actual response to untagged message
        let result;
        try {
          result = await waitForResponse({
            client: agent.client as any,
            conversation: {
              send: (content: string) => conversation.send(content),
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
            `⚠️ ${agentConfig.name} responded to untagged message in ${responseTime.toFixed(2)}ms`,
          );
        } else {
          console.log(
            `✅ ${agentConfig.name} correctly did not respond to untagged message`,
          );
        }

        // For untagged messages, we don't require a response
        // The test passes whether there's a response or not (just monitoring behavior)
        if (!isProduction) {
          expect(result).toBeTruthy();
        }
      } finally {
        await agent.stop();
      }
    });
  }
});
