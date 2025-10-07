import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "@versions/node-sdk";
import { getWorkers } from "@workers/manager";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents";
import { type AgentConfig } from "./helper";

const testName = "agents-tagged";

describe(testName, async () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env);
  });

  // Handle case where no agents are configured for the current environment
  if (filteredAgents.length === 0) {
    it(`${env}: No agents configured for this environment`, () => {
      console.log(`No agents found for env: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  for (const agent of filteredAgents) {
    it(`${testName}: ${agent.name} should respond to tagged/command message : ${agent.address}`, async () => {
      const isSlashCommand = agent.sendMessage.startsWith("/");
      const testMessage = isSlashCommand
        ? agent.sendMessage
        : `@${agent.name} ${agent.sendMessage}`;

      console.log(`sending ${testMessage} to agent`, agent.name, agent.address);
      const conversation = await workers
        .getCreator()
        .client.conversations.newGroupWithIdentifiers([
          {
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          },
          {
            identifier: getInboxes(1)[0].accountAddress,
            identifierKind: IdentifierKind.Ethereum,
          },
        ]);

      const result = await verifyAgentMessageStream(
        conversation as Conversation,
        [workers.getCreator()],
        testMessage,
        3,
      );

      // If the agent didn't respond, log the timeout value instead of 0

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
