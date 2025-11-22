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
  handleEmptyAgents,
  waitForResponse,
  type AgentConfig,
} from "./helper";

const testName = "agents-text";
const TIMEOUT = 16000; // 16 seconds

describe(testName, () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;

  const filteredAgents = filterAgentsByEnv(
    productionAgents as AgentConfig[],
    env,
    true, // live only
  );

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    handleEmptyAgents(testName, env);
    return;
  }

  // Test each agent in DMs
  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} DM : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({
        codecs: [new ActionsCodec(), new IntentCodec()],
      });
      console.log(`📋 Using agent: ${agent.client.inboxId}`);
      console.log(
        `📤 Sending "${agentConfig.sendMessage}" to ${agentConfig.name} (${agentConfig.address})`,
      );

      try {
        const conversation = await agent.createDmWithAddress(
          agentConfig.address as `0x${string}`,
        );
        console.log(`📋 DM created: ${conversation.id}`);

        const result = await waitForResponse({
          conversation: {
            stream: async () => {
              return await conversation.stream();
            },
            send: async (content: string) => {
              return await conversation.send(content);
            },
          },
          senderInboxId: agent.client.inboxId,
          timeout: TIMEOUT,
          messageText: agentConfig.sendMessage,
        });

        const responseTime = result.responseTime || 0;

        // Ensure we have a valid response time (use minimum of 0.01ms if somehow 0)
        const metricValue: number = responseTime > 0 ? responseTime : 0.01;

        // Send metric to DataDog
        sendMetric("response", metricValue, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "text",
          live: agentConfig.live ? "true" : "false",
          agent: agentConfig.name,
          address: agentConfig.address,
        } as ResponseMetricTags);

        if (result.success && result.responseMessage) {
          const responseContent = formatResponseContent(result.responseMessage);
          console.log(
            `✅ ${agentConfig.name} responded in ${responseTime.toFixed(2)}ms`,
          );
          console.log(`💬 Response: "${responseContent}"`);
        } else {
          console.error(`❌ ${agentConfig.name} - NO RESPONSE within timeout`);
        }

        // Only assert in non-production environments
        if (process.env.XMTP_ENV !== "production") {
          expect(result.success).toBe(true);
          expect(result.responseMessage).toBeTruthy();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to test ${agentConfig.name}: ${errorMessage}`);
        throw error;
      } finally {
        await agent.stop();
      }
    });
  }
});
