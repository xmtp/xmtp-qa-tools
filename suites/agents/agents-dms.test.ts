import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyBotMessageStream } from "@helpers/streams";
import { setupTestLifecycle } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-dms";
describe(testName, async () => {
  setupTestLifecycle({ testName });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${env}: No agents configured for this environment`, () => {
      console.log(`No agents found for environment: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  // Test each agent in DMs
  for (const agent of filteredAgents) {
    it(`${env}: ${agent.name} DM : ${agent.address}`, async () => {
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

      const result = await verifyBotMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        agent.sendMessage,
        3, // maxRetries
      );

      const responseMetricTags: ResponseMetricTags = {
        test: testName,
        metric_type: "agent",
        metric_subtype: "dm",
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      };

      sendMetric(
        "response",
        result?.averageEventTiming || streamTimeout,
        responseMetricTags,
      );

      expect(result?.allReceived).toBe(true);
    });
  }
});
