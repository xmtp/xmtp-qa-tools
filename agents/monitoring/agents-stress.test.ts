import productionAgents from "@agents/agents";
import { PING_MESSAGE } from "@agents/helper";
import { Agent, type XmtpEnv } from "@agents/versions";
import { describe, expect, it } from "vitest";

const testName = "agents-stress";

describe(testName, () => {
  const env = process.env.XMTP_ENV as XmtpEnv;
  const filteredAgents = productionAgents.filter(
    (agent) => agent.networks.includes(env) && !agent.live,
  );

  it("should have agents configured for this environment", () => {
    expect(filteredAgents.length).toBeGreaterThan(0);
  });

  for (const agentConfig of filteredAgents) {
    it(`${testName}: ${agentConfig.name} Stress : ${agentConfig.address}`, async () => {
      const agent = await Agent.createFromEnv({});

      try {
        const targetAgentAddress = agentConfig.address as `0x${string}`;
        const numGroups = 50;
        const messagesPerGroup = 10;

        console.log(
          `Creating ${numGroups} groups with ${agentConfig.name} (${targetAgentAddress})`,
        );

        const groups = [];
        for (let i = 0; i < numGroups; i++) {
          const group = await agent.createGroupWithAddresses(
            [targetAgentAddress],
            {
              groupName: `Stress Test Group ${i + 1}`,
            },
          );
          expect(group).toBeDefined();
          expect(group.id).toBeTruthy();
          groups.push(group);
          console.log(`Created group ${i + 1}/${numGroups}: ${group.id}`);
        }

        expect(groups.length).toBe(numGroups);

        console.log(
          `Sending ${messagesPerGroup} messages to each of ${numGroups} groups`,
        );

        let totalSent = 0;
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          for (let j = 0; j < messagesPerGroup; j++) {
            const messageId = await group.sendText(
              `${PING_MESSAGE} - ${j + 1}/${messagesPerGroup} to group ${i + 1}`,
            );
            expect(messageId).toBeDefined();
            totalSent++;
          }
          console.log(
            `Sent ${messagesPerGroup} messages to group ${i + 1}/${numGroups}`,
          );
        }

        expect(totalSent).toBe(numGroups * messagesPerGroup);

        console.log(
          `Completed stress test: ${numGroups} groups, ${messagesPerGroup} messages each (${totalSent} total messages)`,
        );
      } finally {
        await agent.stop();
      }
    });
  }
});
