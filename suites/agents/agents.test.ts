import { getRandomNames, streamTimeout } from "@helpers/client";
import { sendMetric } from "@helpers/datadog";
import { logError } from "@helpers/logger";
import { sendAgentNotification } from "@helpers/notifications";
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
  const workers = await getWorkers(getRandomNames(3), env); // Increased to 3 for group testing

  setupTestLifecycle({
    testName,
    expect,
  });

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Helper function to test agent in DM
  async function testAgentInDM(agent: AgentConfig, testMessage: string) {
    const conversation = await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: agent.address,
        identifierKind: IdentifierKind.Ethereum,
      });
    await conversation.sync();
    let messages = await conversation.messages();
    let countBefore = messages.length;

    let retries = 3;
    let agentResponded = false;
    let result;

    while (retries > 0) {
      messages = await conversation.messages();
      countBefore = messages.length;

      result = await verifyBotMessageStream(
        conversation as Dm,
        [workers.getCreator()],
        testMessage,
      );

      if (result?.allReceived) {
        agentResponded = true;
        break;
      }

      await conversation.sync();
      messages = await conversation.messages();
      // Check if we have exactly 2 messages (sent + received)
      if (messages.length === countBefore + 2) {
        console.warn("messages.length === countBefore + 2");
        agentResponded = true;
        break;
      }
      retries--;
    }

    return { agentResponded, result, messages };
  }

  // Helper function to test agent in group
  async function testAgentInGroup(agent: AgentConfig, testMessage: string) {
    // For group testing, we'll create a group and simulate agent behavior
    // Since agents need to be invited and may not respond to group invitations,
    // we'll use a DM conversation but test group-specific messages
    const conversation = await workers
      .getCreator()
      .client.conversations.newDmWithIdentifier({
        identifier: agent.address,
        identifierKind: IdentifierKind.Ethereum,
      });
    await conversation.sync();
    let messages = await conversation.messages();
    let countBefore = messages.length;

    let retries = 3;
    let agentResponded = false;
    let result;

    while (retries > 0) {
      messages = await conversation.messages();
      countBefore = messages.length;

      result = await verifyBotMessageStream(
        conversation as Dm,
        [workers.getCreator()],
        testMessage,
      );

      if (result?.allReceived) {
        agentResponded = true;
        break;
      }

      await conversation.sync();
      messages = await conversation.messages();
      // Check if we have exactly 2 messages (sent + received)
      if (messages.length === countBefore + 2) {
        agentResponded = true;
        break;
      }
      retries--;
    }

    return { agentResponded, result, messages };
  }

  // Test each agent
  for (const agent of filteredAgents) {
    // DM Test
    it(`${env}: ${agent.name} DM : ${agent.address}`, async () => {
      const errorLogs = new Set<string>();
      let agentResponded = false;
      let result;

      try {
        console.warn(`Testing ${agent.name} DM with address ${agent.address}`);

        const dmResult = await testAgentInDM(agent, agent.sendMessage);
        agentResponded = dmResult.agentResponded;
        result = dmResult.result;

        console.warn(
          "lastMessage DM",
          JSON.stringify(
            dmResult.messages[dmResult.messages.length - 1]?.content,
            null,
            2,
          ),
          "received in",
          result?.averageEventTiming,
        );

        let metricValue = result?.averageEventTiming as number;
        if (!agentResponded) {
          metricValue = streamTimeout;
          errorLogs.add(
            `Agent ${agent.name} failed to respond in DM after 3 retries`,
          );
          errorLogs.add(`Response time exceeded timeout: ${streamTimeout}ms`);
        }

        sendMetric("response", metricValue, {
          test: testName,
          metric_type: "agent",
          metric_subtype: `${agent.name}-dm`,
          agent: agent.name,
          address: agent.address,
          sdk: workers.getCreator().sdk,
        });

        // Send agent-specific notification if the test failed
        if (!agentResponded && errorLogs.size > 0) {
          await sendAgentNotification({
            agentName: agent.name,
            agentAddress: agent.address,
            errorLogs,
            testName: `${testName}-${agent.name}-dm`,
            env,
            slackChannel: agent.slackChannel,
            responseTime: metricValue,
          });
        }

        expect(agentResponded).toBe(true);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        errorLogs.add(
          `Error testing agent ${agent.name} in DM: ${errorMessage}`,
        );

        // Send agent-specific notification for caught errors
        if (errorLogs.size > 0) {
          try {
            await sendAgentNotification({
              agentName: agent.name,
              agentAddress: agent.address,
              errorLogs,
              testName: `${testName}-${agent.name}-dm`,
              env,
              slackChannel: agent.slackChannel,
              responseTime: result?.averageEventTiming || streamTimeout,
            });
          } catch (notificationError) {
            console.error(
              "Failed to send agent notification:",
              notificationError,
            );
          }
        }

        logError(e, expect.getState().currentTestName);
        throw e;
      }
    });

    // Group Tests - only if group testing is enabled for this agent
    if (agent.groupTesting?.enabled) {
      // Test untagged messages in groups
      if (agent.groupTesting.respondsToUntagged) {
        it(`${env}: ${agent.name} Group Untagged : ${agent.address}`, async () => {
          const errorLogs = new Set<string>();
          let agentResponded = false;
          let result;

          try {
            console.warn(
              `Testing ${agent.name} Group Untagged with address ${agent.address}`,
            );

            const untaggedMessage =
              agent.groupTesting?.untaggedMessage || agent.sendMessage;
            const groupResult = await testAgentInGroup(agent, untaggedMessage);
            agentResponded = groupResult.agentResponded;
            result = groupResult.result;

            console.warn(
              "lastMessage Group Untagged",
              JSON.stringify(
                groupResult.messages[groupResult.messages.length - 1]?.content,
                null,
                2,
              ),
              "received in",
              result?.averageEventTiming,
            );

            let metricValue = result?.averageEventTiming as number;
            if (!agentResponded) {
              metricValue = streamTimeout;
              errorLogs.add(
                `Agent ${agent.name} failed to respond to untagged message in group after 3 retries`,
              );
              errorLogs.add(
                `Response time exceeded timeout: ${streamTimeout}ms`,
              );
            }

            sendMetric("response", metricValue, {
              test: testName,
              metric_type: "agent",
              metric_subtype: `${agent.name}-group-untagged`,
              agent: agent.name,
              address: agent.address,
              sdk: workers.getCreator().sdk,
            });

            // Send agent-specific notification if the test failed
            if (!agentResponded && errorLogs.size > 0) {
              await sendAgentNotification({
                agentName: agent.name,
                agentAddress: agent.address,
                errorLogs,
                testName: `${testName}-${agent.name}-group-untagged`,
                env,
                slackChannel: agent.slackChannel,
                responseTime: metricValue,
              });
            }

            expect(agentResponded).toBe(true);
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            errorLogs.add(
              `Error testing agent ${agent.name} in group with untagged message: ${errorMessage}`,
            );

            // Send agent-specific notification for caught errors
            if (errorLogs.size > 0) {
              try {
                await sendAgentNotification({
                  agentName: agent.name,
                  agentAddress: agent.address,
                  errorLogs,
                  testName: `${testName}-${agent.name}-group-untagged`,
                  env,
                  slackChannel: agent.slackChannel,
                  responseTime: result?.averageEventTiming || streamTimeout,
                });
              } catch (notificationError) {
                console.error(
                  "Failed to send agent notification:",
                  notificationError,
                );
              }
            }

            logError(e, expect.getState().currentTestName);
            throw e;
          }
        });
      }

      // Test tagged messages in groups
      if (agent.groupTesting.respondsToTagged) {
        it(`${env}: ${agent.name} Group Tagged : ${agent.address}`, async () => {
          const errorLogs = new Set<string>();
          let agentResponded = false;
          let result;

          try {
            console.warn(
              `Testing ${agent.name} Group Tagged with address ${agent.address}`,
            );

            const taggedMessage =
              agent.groupTesting?.taggedMessage ||
              `@${agent.baseName} ${agent.sendMessage}`;
            const groupResult = await testAgentInGroup(agent, taggedMessage);
            agentResponded = groupResult.agentResponded;
            result = groupResult.result;

            console.warn(
              "lastMessage Group Tagged",
              JSON.stringify(
                groupResult.messages[groupResult.messages.length - 1]?.content,
                null,
                2,
              ),
              "received in",
              result?.averageEventTiming,
            );

            let metricValue = result?.averageEventTiming as number;
            if (!agentResponded) {
              metricValue = streamTimeout;
              errorLogs.add(
                `Agent ${agent.name} failed to respond to tagged message in group after 3 retries`,
              );
              errorLogs.add(
                `Response time exceeded timeout: ${streamTimeout}ms`,
              );
            }

            sendMetric("response", metricValue, {
              test: testName,
              metric_type: "agent",
              metric_subtype: `${agent.name}-group-tagged`,
              agent: agent.name,
              address: agent.address,
              sdk: workers.getCreator().sdk,
            });

            // Send agent-specific notification if the test failed
            if (!agentResponded && errorLogs.size > 0) {
              await sendAgentNotification({
                agentName: agent.name,
                agentAddress: agent.address,
                errorLogs,
                testName: `${testName}-${agent.name}-group-tagged`,
                env,
                slackChannel: agent.slackChannel,
                responseTime: metricValue,
              });
            }

            expect(agentResponded).toBe(true);
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            errorLogs.add(
              `Error testing agent ${agent.name} in group with tagged message: ${errorMessage}`,
            );

            // Send agent-specific notification for caught errors
            if (errorLogs.size > 0) {
              try {
                await sendAgentNotification({
                  agentName: agent.name,
                  agentAddress: agent.address,
                  errorLogs,
                  testName: `${testName}-${agent.name}-group-tagged`,
                  env,
                  slackChannel: agent.slackChannel,
                  responseTime: result?.averageEventTiming || streamTimeout,
                });
              } catch (notificationError) {
                console.error(
                  "Failed to send agent notification:",
                  notificationError,
                );
              }
            }

            logError(e, expect.getState().currentTestName);
            throw e;
          }
        });
      }
    }
  }
});
