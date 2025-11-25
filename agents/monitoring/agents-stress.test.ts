import productionAgents from "@agents/agents";
import { Agent, type XmtpEnv } from "@agents/versions";
import { ActionsCodec } from "agents/utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "agents/utils/inline-actions/types/IntentContent";
import { describe, it } from "vitest";

const testName = "agents-stress";

describe(testName, () => {
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter(
    (agent) => agent.networks.includes(env) && !agent.live,
  );

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} Stress : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({
        codecs: [new ActionsCodec(), new IntentCodec()],
      });

      try {
        const targetAgentAddress = agentConfig.address as `0x${string}`;
        const numGroups = 50;
        const messagesPerGroup = 10;

        console.log(
          `📤 Creating ${numGroups} groups with ${agentConfig.name} (${targetAgentAddress})`,
        );

        // Create 50 groups
        // The test agent (agent) is automatically added when creating the group
        // We just need to add the target agent
        const groups = [];
        for (let i = 0; i < numGroups; i++) {
          const group = await agent.createGroupWithAddresses(
            [targetAgentAddress],
            {
              groupName: `Stress Test Group ${i + 1}`,
            },
          );
          groups.push(group);
          console.log(`✅ Created group ${i + 1}/${numGroups}: ${group.id}`);
        }

        console.log(
          `📨 Sending ${messagesPerGroup} messages to each of ${numGroups} groups`,
        );

        // Send 10 messages to each group
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          for (let j = 0; j < messagesPerGroup; j++) {
            await group.send(
              `Stress test message ${j + 1}/${messagesPerGroup} to group ${i + 1}`,
            );
          }
          console.log(
            `✅ Sent ${messagesPerGroup} messages to group ${i + 1}/${numGroups}`,
          );
        }

        console.log(
          `✅ Completed stress test: ${numGroups} groups, ${messagesPerGroup} messages each (${numGroups * messagesPerGroup} total messages)`,
        );
      } finally {
        await agent.stop();
      }
    });
  }
});
