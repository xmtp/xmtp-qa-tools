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
import { beforeAll, describe, it } from "vitest";

const testName = "agents-dms";

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter((agent: AgentConfig) =>
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

  let agent: Agent;
  beforeAll(async () => {
    agent = await Agent.createFromEnv({
      codecs: [new ActionsCodec(), new IntentCodec()],
    });
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} DM : ${agentConfig.address}`, async () => {
      try {
        const conversation = await agent.createDmWithAddress(
          agentConfig.address as `0x${string}`,
        );

        console.log(
          `📤 Sending "${PING_MESSAGE}" to ${agentConfig.name} (${agentConfig.address})`,
        );

        const result = await waitForResponse({
          client: agent.client as any,
          conversation: {
            send: (content: string) => conversation.send(content),
          },
          conversationId: conversation.id,
          senderInboxId: agent.client.inboxId,
          timeout: AGENT_RESPONSE_TIMEOUT,
          messageText: PING_MESSAGE,
        });

        sendMetric(
          "response",
          result.responseTime ?? AGENT_RESPONSE_TIMEOUT,
          createMetricTags(agentConfig),
        );

        if (result.success && result.responseMessage)
          console.log(
            `✅ ${agentConfig.name} responded in ${result.responseTime.toFixed(2)}ms`,
          );
        else
          console.error(`❌ ${agentConfig.name} - NO RESPONSE within timeout`);
      } finally {
        await agent.stop();
      }
    });
  }
});
