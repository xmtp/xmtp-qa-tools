import { getRandomNames, streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type Dm } from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import { type AgentConfig } from "./agents";
import productionAgents from "./agents.json";

const testName = "agents";

describe(testName, async () => {
  const env = process.env.XMTP_ENV as "dev" | "production";
  const workers = await getWorkers(getRandomNames(3), env);

  setupTestLifecycle({
    testName,
    expect,
  });

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Helper function to test agent response
  async function testAgentResponse(agent: AgentConfig, testMessage: string) {
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

  // Test each agent
  for (const agent of filteredAgents) {
    // DM Test
    it(`${env}: ${agent.name} DM : ${agent.address}`, async () => {
      try {
        const result = await testAgentResponse(agent, agent.sendMessage);

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

    // Group Tests - only if group testing is enabled for this agent
    if (agent.groupTesting?.enabled) {
      // Test untagged messages in groups
      if (agent.groupTesting.respondsToUntagged) {
        it(`${env}: ${agent.name} Group Untagged : ${agent.address}`, async () => {
          try {
            const untaggedMessage =
              agent.groupTesting?.untaggedMessage || agent.sendMessage;
            const result = await testAgentResponse(agent, untaggedMessage);

            sendMetric("response", result.responseTime, {
              test: testName,
              metric_type: "agent",
              metric_subtype: `${agent.name}-group-untagged`,
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

      // Test tagged messages in groups
      if (agent.groupTesting.respondsToTagged) {
        it(`${env}: ${agent.name} Group Tagged : ${agent.address}`, async () => {
          try {
            const taggedMessage =
              agent.groupTesting?.taggedMessage ||
              `@${agent.baseName} ${agent.sendMessage}`;
            const result = await testAgentResponse(agent, taggedMessage);

            sendMetric("response", result.responseTime, {
              test: testName,
              metric_type: "agent",
              metric_subtype: `${agent.name}-group-tagged`,
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
    }
  }
});
