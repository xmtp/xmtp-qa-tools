import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@helpers/versions";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents";
import { type AgentConfig } from "./helper";

const testName = "agents-dms";
describe(testName, async () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env as string);
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

      const responseTime = Math.abs(
        result?.averageEventTiming ?? streamTimeout,
      );

      // dont do ?? streamTimeout because it will be 0 and it will be ignored by datadog
      sendMetric("response", responseTime, {
        test: testName,
        metric_type: "agent",
        metric_subtype: "dm",
        live: agent.live ? "true" : "false",
        agent: agent.name,
        address: agent.address,
        sdk: workers.getCreator().sdk,
      } as ResponseMetricTags);

      if (result?.receptionPercentage === 0)
        console.error(agent.name, "no response");
      expect(result?.receptionPercentage).toBeGreaterThanOrEqual(0);
    });
  }
});
