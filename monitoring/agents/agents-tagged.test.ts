import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getRandomAddress } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "version-management/client-versions";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents.json";
import { type AgentConfig } from "./helper";

const testName = "agents-tagged";

describe(testName, async () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  const filteredAgents = (productionAgents as AgentConfig[]).filter((agent) => {
    return agent.networks.includes(env) && agent.respondOnTagged;
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
        : `@${agent.baseName} ${agent.sendMessage}`;

      console.log(`sending ${testMessage} to agent`, agent.name, agent.address);
      const conversation = await workers
        .getCreator()
        .client.conversations.newGroupWithIdentifiers([
          {
            identifier: agent.address,
            identifierKind: IdentifierKind.Ethereum,
          },
          {
            identifier: getRandomAddress(1)[0],
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
      const metricValue =
        result?.receptionPercentage && result.receptionPercentage > 0
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

      if (!result?.receptionPercentage || result.receptionPercentage === 0) {
        console.error(agent.name, "no response");
      }
      expect(result?.receptionPercentage).toBeGreaterThan(0);
    });
  }
});
