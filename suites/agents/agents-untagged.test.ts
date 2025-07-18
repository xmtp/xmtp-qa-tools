import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getAddresses } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-untagged";

describe(testName, async () => {
  setupTestLifecycle({ testName, sendMetrics: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env) && agent.shouldRespondOnTagged;
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${env}: No agents configured for this environment`, () => {
      console.log(`No agents found for environment: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} should not respond to untagged hi : ${agent.address}`, async () => {
      console.log("sending message to agent", agent.name, agent.address);
      const conversation = await workers
        .getCreator()
        .client.conversations.newGroupWithIdentifiers([
          {
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          },
          {
            identifier: getAddresses(1)[0],
            identifierKind: IdentifierKind.Ethereum,
          },
        ]);

      //Ignore welcome message
      await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        "hi",
      );
      //Ignore welcome message
      const result = await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        "hi",
      );

      // If the agent didn't respond, log the timeout value instead of 0
      const metricValue = result?.allReceived
        ? result.averageEventTiming
        : streamTimeout;
      sendMetric("response", metricValue, {
        test: testName,
        metric_type: "agent",
        metric_subtype: "dm",
        production: agent.live,
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      if (result?.allReceived) console.warn(agent.name, "FAILED");
      expect(result?.allReceived).toBe(false);
    });
  }
});
