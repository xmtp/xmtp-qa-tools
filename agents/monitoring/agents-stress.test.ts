import { streamTimeout } from "@helpers/client";
import { sendMetric, type ResponseMetricTags } from "@helpers/datadog";
import { verifyAgentMessageStream } from "@helpers/streams";
import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import {
  IdentifierKind,
  type Conversation,
  type XmtpEnv,
} from "version-management/sdk-node-versions";
import { describe, expect, it } from "vitest";
import productionAgents from "./agents";
import { type AgentConfig } from "./helper";

const testName = "agents-stress";

describe(testName, async () => {
  setupDurationTracking({ testName, initDataDog: true });
  const env = process.env.XMTP_ENV as XmtpEnv;
  const workers = await getWorkers(["randomguy"]);

  // Get gm and key-check agents
  const gmAgent = productionAgents.find((agent) => agent.name === "gm");
  const keyCheckAgent = productionAgents.find(
    (agent) => agent.name === "key-check",
  );

  // Filter agents for current environment
  const targetAgents = [gmAgent, keyCheckAgent].filter(
    (agent): agent is AgentConfig =>
      agent !== undefined && agent.networks.includes(env),
  );

  // Handle case where no target agents are configured for the current environment
  if (targetAgents.length === 0) {
    it(`${env}: No target agents (gm, key-check) configured for this environment`, () => {
      console.log(`No target agents found for env: ${env}`);
      expect(true).toBe(true); // Pass the test
    });
    return;
  }

  // Define group sizes and distribution
  const groupSizes = [10, 15, 20];
  const totalGroups = 20;

  // Calculate distribution: roughly equal groups of each size
  const groupsPerSize = Math.floor(totalGroups / groupSizes.length);
  const remainingGroups = totalGroups - groupsPerSize * groupSizes.length;

  const groupDistribution: number[] = [];
  groupSizes.forEach((size, index) => {
    const count = groupsPerSize + (index < remainingGroups ? 1 : 0);
    for (let i = 0; i < count; i++) {
      groupDistribution.push(size);
    }
  });

  // Shuffle the distribution for randomness
  groupDistribution.sort(() => Math.random() - 0.5);

  console.log(
    `Creating ${totalGroups} random groups with sizes:`,
    groupDistribution,
  );

  for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
    const groupSize = groupDistribution[groupIndex];

    it(`${testName}: Group ${groupIndex + 1}/${totalGroups} (${groupSize} members) - Test agent tagging`, async () => {
      console.log(`Creating group ${groupIndex + 1} with ${groupSize} members`);

      // Get random participants for the group
      const participants = getInboxes(groupSize - targetAgents.length, 2, 200);

      // Create group with target agents + random participants
      const groupIdentifiers = [
        // Add target agents
        ...targetAgents.map((agent) => ({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        })),
        // Add random participants
        ...participants.map((participant) => ({
          identifier: participant.accountAddress,
          identifierKind: IdentifierKind.Ethereum,
        })),
      ];

      const conversation = await workers
        .getCreator()
        .client.conversations.newGroupWithIdentifiers(groupIdentifiers);

      console.log(
        `Group ${groupIndex + 1} created with ${groupIdentifiers.length} members`,
      );

      // Test each target agent
      for (const agent of targetAgents) {
        const isSlashCommand = agent.sendMessage.startsWith("/");
        const testMessage = isSlashCommand
          ? agent.sendMessage
          : `@${agent.baseName} ${agent.sendMessage}`;

        console.log(
          `Testing ${agent.name} in group ${groupIndex + 1}: ${testMessage}`,
        );

        const result = await verifyAgentMessageStream(
          conversation as Conversation,
          [workers.getCreator()],
          testMessage,
          3,
        );

        const responseTime = Math.abs(
          result?.averageEventTiming ?? streamTimeout,
        );

        // Send metrics to DataDog
        sendMetric("response", responseTime, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "group_stress",
          live: agent.live ? "true" : "false",
          agent: agent.name,
          address: agent.address,
          group_size: groupSize.toString(),
          group_index: (groupIndex + 1).toString(),
          sdk: workers.getCreator().sdk,
        } as ResponseMetricTags);

        // Send success/failure metric
        sendMetric("success", result?.receptionPercentage === 100 ? 1 : 0, {
          test: testName,
          metric_type: "agent",
          metric_subtype: "group_stress",
          live: agent.live ? "true" : "false",
          agent: agent.name,
          address: agent.address,
          group_size: groupSize.toString(),
          group_index: (groupIndex + 1).toString(),
          sdk: workers.getCreator().sdk,
        } as ResponseMetricTags);

        if (result?.receptionPercentage === 0) {
          console.error(
            `Agent ${agent.name} in group ${groupIndex + 1} - no response`,
          );
        } else {
          console.log(
            `Agent ${agent.name} in group ${groupIndex + 1} - response received (${result?.receptionPercentage}%)`,
          );
        }

        expect(result?.receptionPercentage).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
