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
import { beforeAll, describe, expect, it } from "vitest";

// Load .env for keys but preserve XMTP_ENV from runner (--env); gen:keys can overwrite .env with empty/wrong XMTP_ENV
const runnerEnv = process.env.XMTP_ENV;
process.loadEnvFile(".env");
if (runnerEnv) process.env.XMTP_ENV = runnerEnv;

const testName = "agents-dms";
const VALID_ENVS: XmtpEnv[] = ["dev", "production", "local"];

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  if (!env || !VALID_ENVS.includes(env)) {
    throw new Error(
      `XMTP_ENV must be one of ${VALID_ENVS.join(", ")}. Got: ${String(env)}`,
    );
  }
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
    // Ensure SDK sees correct env (e.g. after .env load in worker)
    process.env.XMTP_ENV = env;
    agent = await Agent.createFromEnv();
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} DM : ${agentConfig.address}`, async () => {
      try {
        const conversation = await agent.createDmWithAddress(
          agentConfig.address as `0x${string}`,
        );

        const messageToSend = agentConfig.customText || PING_MESSAGE;
        console.log(
          `📤 Sending "${messageToSend}" to ${agentConfig.name} (${agentConfig.address})`,
        );

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
            messageText: messageToSend,
          });
        } catch {
          result = {
            success: false,
            sendTime: 0,
            responseTime: AGENT_RESPONSE_TIMEOUT,
            responseMessage: null,
          };
        }

        sendMetric(
          "response",
          result.responseTime ?? AGENT_RESPONSE_TIMEOUT,
          createMetricTags(agentConfig),
        );

        expect(result.success).toBe(true);
        expect(result.responseMessage).toBeTruthy();

        console.log(
          `✅ ${agentConfig.name} responded in ${result.responseTime.toFixed(2)}ms`,
        );
      } finally {
        await agent.stop();
      }
    });
  }
});
