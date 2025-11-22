import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { type XmtpEnv } from "@helpers/versions";
import { setupDurationTracking } from "@helpers/vitest";
import { Agent } from "@xmtp/agent-sdk-1.1.14";
import { ActionsCodec } from "agents/utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "agents/utils/inline-actions/types/IntentContent";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents";
import {
  filterAgentsByEnv,
  formatResponseContent,
  waitForResponse,
  type AgentConfig,
} from "./helper";

const testName = "agents-dms";
const TIMEOUT = 30000; // 30 seconds

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const isProduction = env === "production";
  const filteredAgents = filterAgentsByEnv(
    productionAgents as AgentConfig[],
    env,
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
    it(`${testName}: ${agentConfig.name} DM : ${agentConfig.address}`, async () => {
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
          conversation: {
            stream: () => conversation.stream(),
            send: (content: string) => conversation.send(content),
          },
          senderInboxId: agent.client.inboxId,
          timeout: TIMEOUT,
          messageText: agentConfig.sendMessage,
        });

        const responseTime = Math.max(result.responseTime || 0, 0.01);
        sendMetric("response", responseTime, createMetricTags(agentConfig));

        if (result.success && result.responseMessage) {
          const responseContent = formatResponseContent(result.responseMessage);
          console.log(
            `✅ ${agentConfig.name} responded in ${responseTime.toFixed(2)}ms - "${responseContent}"`,
          );
        } else {
          console.error(`❌ ${agentConfig.name} - NO RESPONSE within timeout`);
        }

        if (!isProduction) {
          expect(result.success).toBe(true);
          expect(result.responseMessage).toBeTruthy();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes("timeout");

        console.error(`❌ Failed to test ${agentConfig.name}: ${errorMessage}`);

        if (isProduction && isTimeout) {
          console.warn(
            `⚠️  Production timeout for ${agentConfig.name} - skipping assertion`,
          );
          sendMetric("response", TIMEOUT, createMetricTags(agentConfig));
        } else {
          throw error;
        }
      } finally {
        await agent.stop();
      }
    });
  }
});
