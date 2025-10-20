import { setupDurationTracking } from "@helpers/vitest";
import { getInboxes } from "@inboxes/utils";
import { getWorkers } from "@workers/manager";
import { IdentifierKind, type XmtpEnv } from "@workers/node-sdk";
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
    const isUpfrontCreation = groupIndex % 2 === 0; // 50/50 split: even indices = upfront, odd indices = post-creation

    it(`${testName}: Group ${groupIndex + 1}/${totalGroups} (${groupSize} members) - ${isUpfrontCreation ? "Upfront creation" : "Post-creation addition"}`, async () => {
      console.log(
        `Creating group ${groupIndex + 1} with ${groupSize} members using ${isUpfrontCreation ? "upfront creation" : "post-creation addition"}`,
      );

      // Get random participants for the group
      const participants = getInboxes(groupSize - targetAgents.length, 2, 200);

      let conversation;

      if (isUpfrontCreation) {
        // UPFRONT CREATION: Create group with target agents + random participants from the start
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

        conversation = await workers
          .getCreator()
          .client.conversations.newGroupWithIdentifiers(groupIdentifiers);

        console.log(
          `Group ${groupIndex + 1} created with ${groupIdentifiers.length} members (including agents from start)`,
        );
      } else {
        // POST-CREATION ADDITION: Create group with only random participants first, then add agents
        const participantIdentifiers = participants.map((participant) => ({
          identifier: participant.accountAddress,
          identifierKind: IdentifierKind.Ethereum,
        }));

        conversation = await workers
          .getCreator()
          .client.conversations.newGroupWithIdentifiers(participantIdentifiers);

        console.log(
          `Group ${groupIndex + 1} created with ${participantIdentifiers.length} random participants`,
        );

        // Add target agents after group creation
        const agentIdentifiers = targetAgents.map((agent) => ({
          identifier: agent.address,
          identifierKind: IdentifierKind.Ethereum,
        }));

        await conversation.addMembersByIdentifiers(agentIdentifiers);
        console.log(
          `Added ${agentIdentifiers.length} target agents to group ${groupIndex + 1} after creation`,
        );
      }

      // Test each target agent
      for (const agent of targetAgents) {
        await conversation.send(agent.sendMessage);
        console.log(
          `Testing ${agent.name} in group ${groupIndex + 1}: ${agent.sendMessage}`,
        );
      }
    });
  }
});
