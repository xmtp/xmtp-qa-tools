import { streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { type AgentConfig } from "./agents";
import productionAgents from "./agents.json";

const testName = "agents-dms";

describe(testName, async () => {
  const env = process.env.XMTP_ENV as "dev" | "production";
  const workers = await getWorkers(["alice"]);

  setupTestLifecycle({
    testName,
    expect,
  });

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Helper function to test agent response in DM
  async function testAgentDMResponse(agent: AgentConfig, testMessage: string) {
    const conversation = await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: agent.address,
        identifierKind: IdentifierKind.Ethereum,
      });
    await conversation.sync();

    let retries = 3;
    let result;

    while (retries > 0) {
      const messagesBefore = await conversation.messages();
      const countBefore = messagesBefore.length;

      result = await verifyBotMessageStream(
        conversation as Dm,
        [workers.getCreator()],
        testMessage,
      );

      if (result?.allReceived) {
        return { responded: true, responseTime: result.averageEventTiming };
      }

      await conversation.sync();
      const messagesAfter = await conversation.messages();
      if (messagesAfter.length === countBefore + 2) {
        return {
          responded: true,
          responseTime: result?.averageEventTiming || 0,
        };
      }
      retries--;
    }

    return { responded: false, responseTime: streamTimeout };
  }

  // Test each agent in DMs
  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} DM : ${agent.address}`, async () => {
      try {
        const result = await testAgentDMResponse(agent, agent.sendMessage);

        sendMetric("response", result.responseTime, {
          test: testName,
          metric_type: "agent",
          metric_subtype: `${agent.name}-dm`,
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        expect(result.responded).toBe(true);
      } catch (e) {
        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });
  }
});
