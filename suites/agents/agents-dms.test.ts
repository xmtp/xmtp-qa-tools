import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@workers/versions";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-dms";
describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${testName}: No agents configured for this environment`, () => {
      console.log(`No agents found for env: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  // Test each agent in DMs
  for (const agent of filteredAgents) {
    it(`${testName}: ${agent.name} DM : ${agent.address}`, async () => {
      console.log(
        `sending ${agent.sendMessage} to agent`,
        agent.name,
        agent.address,
      );
      const conversation = await workers
        .getCreator()
        .client.conversations.newDmWithIdentifier({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        });

      const result = await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        agent.sendMessage,
        3,
      );
      console.log(JSON.stringify(result, null, 2));

      // If the agent didn't respond, log the timeout value instead of 0
      const metricValue = result?.allReceived
        ? result.averageEventTiming
        : streamTimeout;

      sendMetric("response", metricValue, {
        test: testName,
        metric_type: "agent",
        metric_subtype: "dm",
        live: agent.live ? "true" : "false",
        status: agent.live ? "live_" + env : "not_live_" + env,
        slackChannel: agent.slackChannel,
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      if (!result?.allReceived) console.error(agent.name, "no response");
      expect(result?.allReceived).toBe(true);
    });
  }
});
