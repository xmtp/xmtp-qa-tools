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
import { ActionsCodec } from "agents/utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "agents/utils/inline-actions/types/IntentContent";
import { describe, expect, it } from "vitest";

const testName = "agents-text";

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter((agent) =>
    agent.networks.includes(env),
  );

  const createMetricTags = (agentConfig: AgentConfig): ResponseMetricTags => ({
    test: testName,
    metric_type: "agent",
    metric_subtype: "text",
    live: agentConfig.live ? "true" : "false",
    agent: agentConfig.name,
    address: agentConfig.address,
    sdk: "",
  });

  it("should have agents configured for this environment", () => {
    expect(filteredAgents.length).toBeGreaterThan(0);
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} text : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({
        codecs: [new ActionsCodec(), new IntentCodec()],
      });

      try {
        const conversation = await agent.createDmWithAddress(
          agentConfig.address as `0x${string}`,
        );

        const messageToSend = agentConfig.customText || PING_MESSAGE;
        console.log(
          `Sending "${messageToSend}" to ${agentConfig.name} (${agentConfig.address})`,
        );

        const result = await waitForResponse({
          client: agent.client as any,
          conversation: {
            send: (content: string) => conversation.send(content),
          },
          conversationId: conversation.id,
          senderInboxId: agent.client.inboxId,
          timeout: AGENT_RESPONSE_TIMEOUT,
          messageText: messageToSend,
          messageFilter: (message) => {
            return message.contentType?.typeId === "text";
          },
        });

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
