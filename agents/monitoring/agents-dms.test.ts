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
import { beforeAll, describe, expect, it } from "vitest";

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

  it("should have agents configured for this environment", () => {
    expect(filteredAgents.length).toBeGreaterThan(0);
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} DM : ${agentConfig.address}`, async () => {
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
      });

      if (result.success) {
        sendMetric(
          "response",
          Math.max(result.responseTime || 0, 0.0001),
          createMetricTags(agentConfig),
        );
      }

      expect(result.success).toBe(true);
      expect(result.responseMessage).toBeTruthy();

      console.log(
        `${agentConfig.name} responded in ${result.responseTime.toFixed(2)}ms`,
      );
    });
  }
});
