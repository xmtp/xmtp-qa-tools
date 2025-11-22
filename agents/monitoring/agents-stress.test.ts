import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { Agent, type XmtpEnv } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { ActionsCodec } from "agents/utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "agents/utils/inline-actions/types/IntentContent";
import { describe, it } from "vitest";
import productionAgents from "./agents";
import {
  AGENT_RESPONSE_TIMEOUT,
  waitForResponse,
  type AgentConfig,
} from "./helper";

const testName = "agents-stress";

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter((agent) =>
    agent.networks.includes(env),
  );

  const createMetricTags = (agentConfig: AgentConfig): ResponseMetricTags => ({
    test: testName,
    metric_type: "agent",
    metric_subtype: "stress",
    live: agentConfig.live ? "true" : "false",
    agent: agentConfig.name,
    address: agentConfig.address,
    sdk: "",
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} Stress : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({
        codecs: [new ActionsCodec(), new IntentCodec()],
      });

      try {
        const conversation = await agent.createDmWithAddress(
          agentConfig.address as `0x${string}`,
        );

        console.log(
          `📤 Sending "${agentConfig.sendMessage}" to ${agentConfig.name} (${agentConfig.address})`,
        );

        const result = await waitForResponse({
          client: agent.client as any,
          conversation: {
            send: (content: string) => conversation.send(content),
          },
          conversationId: conversation.id,
          senderInboxId: agent.client.inboxId,
          timeout: AGENT_RESPONSE_TIMEOUT,
          messageText: agentConfig.sendMessage,
        });

        const responseTime = Math.max(result.responseTime || 0, 0.0001);
        sendMetric("response", responseTime, createMetricTags(agentConfig));

        if (result.success && result.responseMessage)
          console.log(
            `✅ ${agentConfig.name} responded in ${responseTime.toFixed(2)}ms`,
          );
        else
          console.error(`❌ ${agentConfig.name} - NO RESPONSE within timeout`);
      } finally {
        await agent.stop();
      }
    });
  }
});
